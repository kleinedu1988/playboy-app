# Changelog

Všechny podstatné změny programu. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze mají tvar MAJOR.MINOR.PATCH (`x.xx.xxx`, bez nul na začátku; do 1.1.4 `x.xx.xx`) podle oddílu „Pravidlo verzování“
v [ROADMAP.md](ROADMAP.md): MAJOR = milník, MINOR = téma z plánu, PATCH = krok nebo oprava. Starší milníky
(0.9.0, alfa 0.50.0) mají v repozitáři značky `vX.Y.Z`, nové se nedělají.

Verze 0.20–0.29 nebyly vydány: po 0.19.2 následovala rovnou 0.30.0 se změnou schématu i exportu.

## [1.46.0] – 2026-11-10

### Přidáno
- **Rok ve sbírce** (`rok_ve_sbirce.go`, `frontend/src/lib/rok-ve-sbirce.js`, `frontend/src/app/rok-ve-sbirce.js`):
  tlačítko „Rok ve sbírce →“ v heru Statistik otevře výroční přehled s volbou roku (bez volby letošní, a když se
  letos ještě nepracovalo, poslední rok s prací). Ukáže přibylé modelky, alba, fotky a čísla (podle data přidání;
  album a číslo se počítá do roku své první fotky) se srovnáním s loňskem, kolik nových fotek už má srdíčka a kolik
  pět, dny práce a nejdelší sérii dní v řadě (přidání fotek a modelek, porovnání v Hodnocení, zápisy Údržby),
  sloupce po měsících s nejaktivnějším měsícem, nejlépe hodnocené nové fotky (nejvýš dvě od jedné modelky), nové
  modelky podle hodnocení, ročníky dokončené v tom roce (všechny vyšlé měsíce s centerfoldem, poslední přibyl
  v roce) a vyhlášené sezóny s Favoritkou a Miláčkem. Klik na fotku nebo modelku otevře profil, na číslo detail čísla.
- **Jako časopis**: přehled roku v režimu čtení – obálka s nejlepší fotkou roku, rok v číslech, nové modelky,
  nejlepší fotky a strana Dokončeno a vyhlášeno; prezentace, prolínání a Ken Burns jako u čísla.
- **Tisk / PDF**: přehled roku se vytiskne nebo uloží do PDF systémovým dialogem tisku, na bílém papíře bez
  ostatního obsahu okna.



### Přidáno
- **Údržba › Otočené a výřezy** (`otocene_fotky.go`, `internal/obsah/otoceni.go`, `frontend/src/app/udrzba-fotky.js`):
  „Zkontrolovat otočení“ projde na pozadí fotky s vektorem obsahu (potřebuje Obsah fotek). Ke každé fotce spočítá
  vektory CLIP náhledu otočeného o 90°, 180° a 270° a porovná všechny čtyři orientace se středem sbírky; výsledky
  se uloží do `obsah/otoceni.json`, takže kontrola jde přerušit a příště pokračuje. Fotky, u kterých jiná orientace
  sedí výrazně lépe než současná, jsou vedle sebe „teď“ a „po otočení“: Otočit (i všechny zobrazené najednou)
  nebo V pořádku (fotka je tak schválně, už se nehlásí); obojí jde vrátit.
- **Návrh výřezu titulní fotky**: detektor NudeNet najde na náhledu postavu a obličej (kdo to je, nepozná) a navrhne
  výřez pro kartu 3 : 4. V okně výřezu je tlačítko Navrhnout; v Údržbě seznam titulních fotek s výchozím výřezem
  s návrhem vedle výchozího, Použít (i všech navržených) nebo Nechat výchozí. Nic se neotočí ani neuloží bez kliknutí.
- Vypnutí Obsahu fotek zastaví kontrolu otočení a smaže i její výsledky.
- Roadmapa: nové etapy G Vzhled a čitelnost (1.49–1.51: přiblížení, hustota a karty, světlý motiv a kontrast, klid
  a vlastní Přehled) a H Návrat k hotovým funkcím (1.52–1.55: Údržba jako jedna fronta, hledání a výběry 2,
  statistiky a vkus 2, prohlížení a časopis 2); výtisky jsou etapa I (1.56–1.59), odložené etapa J (1.60–1.63).
  Decentní zlatá zůstává jako doplněk vzhledu vedle růžového akcentu.

### Známé
- Práh hlášení otočení (`prahOtoceni = 0,02`) ještě není ověřený na vzorku 50 fotek; doladí se v opravné verzi 1.45.x.

## [1.44.0] – 2026-11-09

### Přidáno
- **Údržba › Z webu**: „Projít sbírku na webu…“ projde všechny modelky (nebo jen ty s chybějícími údaji) proti
  Wikidatům, Wikipedii a Boobpedii na pozadí, jeden dotaz za sekundu na server. Průběh je vidět, průchod jde přerušit
  a dokončit i po restartu (stav v tabulce `nastaveni`) (`pruchod_webem.go`, `frontend/src/app/udrzba-web.js`).
- Rozdíly proti zdrojům čekají ve frontě po modelkách se stávající hodnotou, návrhem a odkazem na zdroj.
  Přijímají se po jednom (Doplnit / Opravit), u modelky „přijmout vše“, nebo filtrem po údaji či zdroji
  „Přijmout zobrazené“ – hromadně jen jednoznačné (zdroje se na hodnotě shodují) a předtím se vytvoří záloha.
  Přijatý údaj zapíše i odkaz na zdroj.
- Opravy už vyplněných údajů jsou skryté za volbou „i opravy vyplněných“; odmítnuté hodnoty se pamatují,
  znovu se nenabízí ani v dalším průchodu a jde je vrátit. Nic se nezapíše bez potvrzení.

## [1.43.0] – 2026-11-09

### Přidáno
- **Ročník podle Wikipedie**: Playmate všech měsíců ze seznamu „List of Playboy Playmates of RRRR“ (i víc Playmate
  v jednom měsíci) a Playmate roku proti sbírce. U každé stav ve sbírce / chybí / podobné jméno (překlep) / v čísle
  je jiná / jiný měsíc / bez centerfoldu (u Playmate roku bez alba Playmate roku), s odkazem na zdroj
  (`rocnik_wikipedie.go`, `frontend/src/app/rocnik-wiki.js`).
- Chybějící Playmate (zaškrtnuté) se přidají jedna po druhé rychlým oknem Nová modelka s předvyplněným jménem
  a číslem; po uložení se rovnou otevře další.
- U podobného jména jde jméno z Wikipedie převzít (dosavadní přejde do dalších jmen), nebo jen přidat jako další jméno.
- Otevírá se z kontextové nabídky roku v Kalendáři, tlačítkem na stránce ročníku a klikem na rok v americké mapě sbírky.

### Změněno
- Roadmapa: nové etapy E Kvalita dat ve velkém (1.43–1.45), F Přehledy a pohodlí (1.46–1.48) a G Sbírka výtisků
  (1.49–1.52, včetně tiskových sestav přesunutých z 1.43); kvíz, průvodce číslem a Google Disk odloženy do etapy H
  (1.53–1.56). Etapa D je uzavřená verzemi 1.41–1.42.

## [1.42.0] – 2026-11-09

### Přidáno
- **Zdraví sbírky** v Údržbě › Souhrn: poslední záloha, počet a velikost záloh; export do souboru (jediná záloha mimo
  počítač) s jemnou připomínkou, když je starší než 14 dní (nebo žádný) a od té doby přibylo aspoň 20 změn; poslední
  ověření souborů na Disku, ověřené a nedostupné fotky; velikost náhledů, mezipaměti prohlížeče, databáze a obsahu
  fotek se stavem modelu; počet úkolů k doplnění. Rychlé akce Zálohy…, Exportovat…, Zkontrolovat
  (`zdravi_sbirky.go`, `frontend/src/app/zdravi.js`).
- **Rozdíl před obnovením zálohy**: Obnovit… napřed nanečisto porovná zálohu se současnou databází – modelky, čísla,
  alba, fotky a články, které přibudou, zmizí nebo se změní, s příklady a u změn i se změněnými údaji; teprve pak
  Obnovit tento stav. Porovnání zvládne i zálohu se starším schématem (srovnává společné sloupce).
- Datum posledního exportu se ukládá do nastavení (`posledni_export`).

## [1.41.0] – 2026-11-09

### Přidáno
- **Režim čtení**: tlačítko Jako časopis v detailu čísla a Časopis v profilu modelky otevře obsah přes celou obrazovku
  jako redakční dvoustrany – číslo v pořadí obálka → Playmate měsíce (údaje, průvodní text, fotograf) → další modelky →
  články (dlouhé na víc stran, ve dvou sloupcích, se skeny) → zbylé fotky; profil v pořadí úvod s titulní fotkou
  a poznámkou → články → alba (`frontend/src/lib/casopis.js`, `frontend/src/app/casopis.js`).
- Ovládání šipkami, mezerníkem (Shift+mezerník zpět), PageUp/PageDown, Home/End a klikem (levá třetina zpět); Esc
  zavře a vrátí okno z celé obrazovky. Lišta a kurzor zmizí, když se myš nehýbe; dole proužek postupu.
- **Prezentace** (P nebo tlačítko): listuje po 3 / 5 / 10 s (zapamatuje se), s prolínáním a pomalým přiblížením či
  oddálením fotky (Ken Burns) k místu výřezu portrétu; při omezeném pohybu v systému bez animace.

## [1.40.0] – 2026-11-09

### Přidáno
- **Odkazy `[[…]]`** v poznámkách modelek, průvodních textech alb, článcích a poznámkách čísel: `[[Jméno modelky]]`
  (i další jméno, bez diakritiky), `[[06/1995]]` (i `[[1995-06]]`, `[[06/1995 DE]]`), `[[Fotograf]]` a s popiskem
  `[[cíl|popisek]]`. V hotovém textu klikací odkaz s vizitkou při najetí (fotka a údaje modelky, obálka a Playmate
  čísla); neznámý cíl se vyhledá (`frontend/src/lib/odkazy.js`, `frontend/src/app/wiki-odkazy.js`).
- **Našeptávač v editoru textu** po napsání `[[`: modelky, čísla a fotografové (šipky, Enter / Tab, Esc); odkazy
  jsou v editoru zvýrazněné.
- **Zmiňováno v…** v profilu modelky a v detailu čísla: všechna místa, která na ně odkazují, s úryvkem textu
  a přechodem na modelku, článek nebo číslo (`zminky.go`).

## [1.39.0] – 2026-11-09

### Přidáno
- **Pás fotek čísla** v detailu čísla: všechny fotky vydání (cover, centerfold, pictorialy) v jedné vodorovné řadě v pořadí
  prohlížeče; klik otevře prohlížeč jen pro toto číslo, tlačítko Promítat promítá celé číslo.
- **Kontext čísla v profilu**: štítky čísel u alb a v údajích modelky mají malý náhled obálky; po najetí myší nebo zaměření
  klávesnicí bublina s obálkou, Playmate měsíce, dalšími modelkami sbírky v čísle (s rolí centerfold / obálka / pictorial)
  a přechodem na předchozí a následující měsíční číslo téže edice (`frontend/src/app/kontext-cisla.js`,
  `frontend/src/lib/kontext-cisla.js`).

## [1.38.0] – 2026-11-09

### Přidáno
- **Doplnit z webu** (tlačítko Z webu v profilu): údaje modelky z Wikidat, Wikipedie (infobox v seznamu Playmate jejího
  měsíce) a Boobpedie – narození a úmrtí, místo, národnost, etnicita, výška, váha, míry, velikost a typ prsou, vlasy, oči,
  ochlupení. Hodnoty se převedou do podoby sbírky (česky, cm, kg, evropská velikost prsou: 36DD → 80E), okno ukáže jen
  údaje, které chybí nebo se liší, s volbou „ponechat“ nebo hodnoty ze zdroje; zapíše se jen zvolené a použité zdroje
  přibudou do odkazů modelky (`zdroje_udaju.go`, `frontend/src/app/zdroje-udaju.js`).
- Osoba se ověřuje: povolání Playboy Playmate a rok narození (Wikidata, i přes odkaz na článek Wikipedie), jméno v seznamu
  Playmate jejího měsíce (Wikipedie), rok narození a měsíc Playmate (Boobpedia); jmenovkyně se nepoužije.
- **Úplnost čísla** v detailu čísla: cover, centerfold, kdo je na obálce, pictorial, obsah a fotky s rychlým doplněním;
  u amerického měsíčního čísla Playmate měsíce podle Wikipedie, zda je ve sbírce, a přidání chybějící přes rychlé okno
  Nová modelka (předvyplněné jméno a číslo).
- Na internet se program ptá jen na kliknutí, nejvýš jednou za sekundu na server, odpovědi drží hodinu v paměti.

### Opraveno
- Test vyprchání zájmu o kolekce padal podle denní doby (večer).

## [1.37.0] – 2026-11-09

### Přidáno
- **Chytré výběry ⚡:** hledání a filtr Modelek, nebo hledání, filtry, kolekce a řazení Galerie fotek se dají uložit jako
  pojmenovaný živý výběr s popisem („⚡ Uložit jako chytrý výběr…“). Ukládají se podmínky, ne položky: nová modelka nebo
  fotka, která jim vyhoví, je ve výběru hned (`chytre_vybery.go`, `frontend/src/app/chytre-vybery.js`).
- Čipy ⚡ s počtem v liště Modelek, ve volbách Všech fotek a v panelu Kolekce (čip zapnutého výběru svítí), karta Chytré
  výběry s náhledy v Přehledu; klik výběr zapne, ✎ otevře okno s podmínkami, převzetím aktuálních podmínek, zmrazením
  (fotky do běžného výběru v Nejlepších, modelky do tagu) a smazáním.
- Export a import chytré výběry zachovají v nepovinné části `nastaveni`; schéma databáze (úprava č. 16) ani verze
  exportu (13) se nemění, starší program část přeskočí.

### Změněno
- Dřívější Uložené výběry Galerie fotek se při prvním spuštění převedou na chytré výběry fotek.

## [1.36.0] – 2026-11-09

### Přidáno
- **Chytré hledání:** pole hledání rozumí českým výrazům – `blond`, `brunetka`, `zrzka`, `modré oči`, `výška > 175`, `pas <= 60`,
  `bmi < 18,5`, `whr < 0,7`, `mladší než 21` (věk v prvním čísle), `výška 170 až 180`, `90. léta`, `devadesátá léta`, `1995–1999`,
  `česká edice`, `pmoy`, `pmom`, `cyber girl`, `4*+`, `5*`, `♥ 3,5+`, `s tetováním`, `bez tetování`, `bez fotek`, `bez srdíček`;
  mínus výraz vyloučí (`-blond`). Převod platí v Modelkách, panelu Filtry, Galerii fotek, na stěně, v Nejlepších, Kalendáři,
  Číslech i v našeptávači (`frontend/src/lib/hledani-dotaz.js`).
- **Čipy pod polem hledání:** každá rozpoznaná podmínka (i ručně psaný příkaz) má čip (`Výška > 175 cm`, `1990–1999`, `♥ 4+`),
  × ji jedním klikem z textu odebere (`app/hledani-cipy.js`).
- **Našeptávač:** skupina Chytré výrazy podle psaného slova, `Tab` doplní zvolený nebo první výraz, příkaz či hodnotu.
- **Nové příkazy hledání:** `pas:`, `hrudnik:`, `boky:`, `bmi:`, `whr:`, `vek:` (věk v prvním čísle) a `fotek:` (počet fotek),
  i s desetinnou čárkou a rozsahy; v backendu (`internal/hledani`) i ve frontendu stejně.
- **Příkazy v Galerii fotek:** vzhled a míry platí pro modelku fotky, srdíčka, rok a edice pro fotku (`galerie_fotek.go`);
  stěna a Nejlepší posuzují vzhled a míry podle modelky fotky.

### Změněno
- Zásobník odkazů je na konci profilu pod alby; po vložení nebo přetažení odkazů se sám ukáže.

## [1.35.0] – 2026-11-09

### Přidáno
- **Zásobník odkazů v profilu (`frontend/src/app/zasobnik.js`)**: pruh nad alby, kam se průběžně odkládají odkazy na fotky z Google Disku – <kbd>Ctrl</kbd>+<kbd>V</kbd> kdekoli v profilu mimo pole, přetažení odkazu nebo textu z prohlížeče, psaní. Ukazuje počet platných odkazů a fotky, které už ve sbírce jsou; <kbd>Ctrl</kbd>+<kbd>Enter</kbd> nebo Přidat vloží nové do zvoleného alba, „Nové album…“ je předá do okna alba. Rozepsaný text i zvolené album se pamatují pro každou modelku (i po restartu).
- **Fotky, které už ve sbírce jsou, před vložením (`rychle_pridani.go` `ZkontrolovatOdkazy`, `frontend/src/app/kontrola-odkazu.js`)**: v zásobníku, v okně alba i v rychlém okně živý výpis s náhledem, modelkou a albem; vloží se jen nové fotky, pokud uživatel nezaškrtne „Vložit i ty, které už ve sbírce jsou“. Odkaz na složku Disku se ohlásí hned.
- **Rychlé okno Nová modelka (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> odkudkoli)**: jméno, první výskyt (rok, měsíc, edice, Centerfold / Pictorial), narození jako datum, rok nebo věk v čísle (`lib/rychle-pridani.js` z něj spočítá rok narození; nápověda ukáže obvyklý věk z té doby), národnost předvyplněná odhadem z edice a doby (jen zřetelně nejčastější) a odkazy na fotky; fotky s číslem se uloží jako jeho centerfold nebo pictorial s vydáním. <kbd>Enter</kbd> / <kbd>Ctrl</kbd>+<kbd>Enter</kbd> uloží a otevře profil, „Uložit a další“ nechá číslo vyplněné pro další modelku.

### Změněno
- Upozornění na stejné fotky po vložení (`upozornitNaStejne`) je v `udrzba-stejne.js` a používá ho okno alba, zásobník i rychlé okno; kontroluje jen opravdu vložené soubory.

## [1.34.0] – 2026-11-09

### Přidáno
- **Křivka a rozpětí u grafů v čase (`frontend/src/lib/krivky.js`, `frontend/src/app/statistiky.js`)**: přepínač Sloupce / Křivka a rozpětí v legendě grafu. Údaje: medián z okna sedmi let (u přibývání tří měsíců) se stínovaným pásmem 25.–75. percentilu z hodnot všech modelek okna; podíly: podíl okna s Wilsonovým 95% intervalem spolehlivosti; počty: průměr okna s plochou. Okno s méně než pěti modelkami křivku přeruší, bublina u roku ukáže hodnotu, rozpětí a počet modelek okna. Volba se pamatuje.
- **Porovnat období (graf ve skupině Srovnání)**: dvě období A a B podle roku prvního výskytu (edice a druh výskytu jako u grafů v čase, ostatní podmínky výběru platí) – předvolby desetiletí s počty modelek a vlastní roky od–do. Pod nimi průkazné a podstatné rozdíly mezi obdobími (`porovnatObdobi` v `lib/postrehy.js`: Mann–Whitney u údajů, Fisher u podílů a nejčastějších hodnot rozložení, oprava Benjamini–Hochberg) větou s podrobnostmi v bublině a rozbalovací tabulka všech porovnaných údajů s hodnotami obou období, počty modelek a q; klik na údaj otevře jeho graf. Seznam vpravo ukazuje modelky obou období.

### Změněno
- `rozdilyVyberu` vrací i tabulku všech testovaných příznaků a umí věty srovnání dvou skupin.

## [1.33.0] – 2026-11-09

### Přidáno
- **Perceptuální otisky fotek (`otisky.go`)**: 64bitový dHash a pHash (DCT 32 × 32) v čistém Go z náhledů w400; počítají se na pozadí tři minuty po startu (náhledy ustupují oknu jako stahování na pozadí) a ukládají do `otisky.bin` vedle mezipaměti náhledů, průběžně po 200 fotkách a při zavření programu. Databáze sbírky ani export se nemění.
- **Údržba › Stejné fotky (`stejne_fotky.go`, `frontend/src/app/udrzba-stejne.js`)**: čtvrtý režim Údržby se skupinami souborů, které vypadají jako tatáž fotka – podle otisků v celé sbírce (stejná / skoro stejná) a podle vektoru obsahu ≥ 0,985 u fotek téže modelky (velmi podobná). Soubory skupiny jsou vedle sebe s modelkou, albem, typem, vydáním, srdíčky, tagy a odkazem na plné rozlišení; předvybraný k ponechání je soubor s víc srdíčky, tagy a místy.
- **Nechat vybranou**: v albu, kde ponechaný soubor už je, se kopie odebere a její srdíčka (vyšší) a tagy přejdou na ponechanou fotku; v ostatních albech se jen vymění soubor, takže album o fotku nepřijde. Se zálohou předem a s Vrátit (vrátí záměny, srdíčka, tagy i odebrané fotky s tagy).
- **V pořádku (nejsou stejné)**: dvojice souborů se uloží do nastavení a skupina se už nehlásí; jde vrátit.
- **Upozornění po vložení fotek**: otisky nových souborů se porovnají se sbírkou a shoda nabídne v oznámení „Ukázat“ (Údržba › Stejné fotky).

### Změněno
- `OdebratFotky` sbírá údaje pro Vrátit ve sdílené funkci `obnovaFotky` (používá ji i sloučení stejných fotek).

## [1.32.0] – 2026-11-09

### Přidáno
- **Podobné modelky na fotkách (`podobne_modelky.go`, `GetPodobnostObsahu`)**: vizuální příbuznost modelek jako kosinová podobnost středů vektorů obsahu (CLIP) jejich fotek (jen z aspoň 3 fotek s vektorem, fotky sdíleného alba se počítají všem jeho modelkám); středy se drží v paměti, dokud se nezmění fotky, alba, fotografové ani počet vektorů.
- **Přepínač Údaje / Na fotkách v profilu › Podobné modelky** (`frontend/src/lib/mapa-sbirky.js`, `frontend/src/app/profil.js`): režim Na fotkách z 65 % rozhoduje podobnost fotek (přeškálovaná na rozpětí mezi kandidáty) a ukazuje jen modelky se spočítanými fotkami; nejbližší mají důvod „podobné fotky“. Přepínač se ukáže, jen když modelka má dost fotek s vektorem, a režim se pamatuje.
- **Společný fotograf jako důvod podobnosti** („foto S. Wayda“, i jiný zápis jména, alba s víc fotografy a sdílená alba); podobnost mírně zvedne.
- **⚔ Porovnat s touto**: dvojice jde do Hodnocení › Porovnat jako první, ať je Hodnocení načtené, nebo ne.

### Změněno
- Roadmapa přečíslovaná po 1.31 (Síň slávy mimo plán): Podobné modelky 1.32, Stejné a podobné fotky 1.33, Křivky 1.34, etapy B–D 1.35–1.47.

## [1.31.0] – 2026-11-09

### Přidáno
- **Podobné modelky v profilu (`frontend/src/lib/mapa-sbirky.js`, `frontend/src/app/profil.js`)**: v panelu Údajů pět nejpodobnějších modelek s důvody podobnosti (směs Gowerovy podobnosti a 8-D kódu z PCA, váha kódu podle jistoty vektoru) a odkaz „Na mapě →“, který otevře Mapu sbírky se zvýrazněnou modelkou.
- **Mapa sbírky**: kategorie v legendě jsou tlačítka, klik vyfiltruje body dané barvy; Gowerova podobnost počítá i věk v 1. čísle, typ prsou a tetování.
- **Ikony pilulek Profily, Galerie a Centerfoldy (`frontend/src/ui/volby.js`)**: v úzké kapsli mají všechny části ikonu.

### Změněno
- **Síň slávy je část Modelek** (Profily · Galerie · Statistiky · Síň slávy): samostatné tlačítko v kapsli zmizelo, sekce jsou čtyři a Sbírka má zkratku <kbd>Ctrl</kbd>+<kbd>4</kbd>; mapa sekcí, nápověda a zkratky jsou upravené.
- **Hero záhlaví Síně slávy (`frontend/src/app/sin-slavy.js`)** místo hlavičky v záhlaví okna: jednička Top 10 na velké fotce s ♛, dny na trůnu, věta o sezóně a akce (Vitrína, Vyhlásit / Zvolit téma, Vyzvat o trůn, Profil); pod herem lepivý pás pohledů s panely a filtrem Kroniky. Hero se při přepnutí pohledu nepřekresluje.
- **Pás karet je součástí hera** ve Statistikách i Síni slávy: fotka jde až pod karty, karty jsou „kapitoly“ s linkou nahoře (zvolený postřeh plná linka, v Síni postup sezóny a odznaku).

### Opraveno
- Gowerova podobnost nepočítá rok, vlasy, oči a národnost dvakrát (i bez opakovaných důvodů).
- Mezipaměť podobnosti se opravdu použije (seznam modelek chodí jako nová kopie pole), zvýraznění na mapě se po běžném vstupu do Statistik ruší a filtr z legendy se ptá aktuální mapy.

## [1.30.0] – 2026-11-09

### Přidáno
- **Mapa sbírky ve Statistikách (`frontend/src/lib/mapa-sbirky.js`, `frontend/src/app/statistiky.js`, `frontend/src/style.css`)**:
  - Nová karta ve Statistikách **Mapa sbírky** (`Graf ▾` → `Rozložení` → `Mapa sbírky`), kde je každá modelka bodem v rovině a blízké body představují podobné modelky podle všech klíčových údajů (robustní z-skóre postavy a věku, masky chybějících údajů, období prvního výskytu, barva vlasů a očí, národnost, kategorie a tělesné příznaky).
  - Deterministická projekce hlavních komponent (PCA) s pevnou orientací os (starší období vlevo, vyšší postava nahoře), škálováním 1.–99. percentilu na $[-1, 1]$ a uzavřeným ortogonálním Procrustovým zarovnáním (`procrustes2D`) pro stabilitu souřadnic.
  - Přepínání barevného režimu bodů (Období, Barva vlasů, Kategorie, Hodnocení, Úplnost údajů) s přehlednou legendou, zobrazení modelek s málo vyplněnými údaji jako dutých kroužků, bublina se shrnutím údajů a dvěma nejbližšími sousedy na mapě a Gowerova podobnost se společnými rysy (`gowerPodobnost`).
  - Interaktivní výběr lasem (`bodVMnohouhelniku`) tažením myší na mapě zúží všechny ostatní grafy i pravý seznam modelek a spočítá postřehy výběru; kliknutí na bod otevře profil modelky.

## [1.29.0] – 2026-11-09

### Přidáno
- **Postřehy ve Statistikách – neobvyklé roky, souvislosti a standardizace podle desetiletí (`frontend/src/lib/statistika.js`, `frontend/src/lib/postrehy.js`, `frontend/src/app/statistiky.js`)**:
  - Doplněna Spearmanova pořadová korelace $\rho$ se shodami a oboustrannou $p$-hodnotou přes Studentovo $t$-rozdělení (`spearman`).
  - Hledání neobvyklých roků (`neobvykleRoky`), které s aspoň 8 modelkami průkazně a podstatně vybočují ze zbytku svého období mezi zlomy (Fisherův přesný test a Cohenovo $h$ pro podíly, Mannův–Whitneyův test a Cliffovo $\delta$ pro údaje, Benjaminiho–Hochbergova oprava přes testované roky); kliknutí v záhlaví Statistik přepne na graf a rovnou vybere daný rok.
  - Hledání průkazných souvislostí mezi číselnými vlastnostmi a hodnocením modelek (`souvislosti`, $|\rho| \ge 0{,}3$, $n \ge 30$, oprava BH) s automatickým vyloučením matematicky odvozených dvojic (BMI s výškou/váhou, poměr pas : boky s pasem/boky) a jasným upozorněním, že souvislost neznamená příčinu.
  - Přímá standardizace rozdílů výběru podle desetiletí (`jeVysvetlenoDobou`): pokud je rozdíl vybrané skupiny oproti sbírce vysvětlen dobou, ze které vybrané modelky pocházejí, bublina podrobností na to upozorní.
- **Aktualizace plánu vývoje (`ROADMAP.md`)**: zaznamenány dokončené milníky `1.0–1.29` a rozpracován podrobný plán etap A–D (`1.30–1.46`).

## [1.28.4] – 2026-11-09

### Změněno
- **Rychlejší výpočet a nižší alokace v jazykovém a obrazovém modelu (`internal/obsah`)**:
  - Předzpracování snímků pro CLIP (`predzpracovatDo`) a NudeNet (`predzpracovatDetektorDo`) nahrazuje statisíce plovoucích dělení na každý snímek předpočítanými převodními tabulkami `uint8 → float32` a přímým zápisem do kanálů R, G, B.
  - Český jazykový model (`TextovyModel`) přistupuje k vrstvám transformeru přímo přes typované pole struktur bez běhového skládání názvů tenzorů (`fmt.Sprintf`) a mapových vyhledávání, recykluje pracovní matice aktivací přes `sync.Pool`, rozbaluje vnitřní smyčku skalárního součinu `int8` 4× a při WordPiece tokenizaci krájí UTF-8 řetězce přímo nad zásobníkovými poli bez alokací `[]rune` a `"##" + kus`.
  - Učení tagů z Průvodce (`naucitTagy`) skládá matici $X^T X$ pouze jednou po 5 částech místo 15–18× opakovaného přepočítávání přes všechny příklady, vynechává křížové ověření u tagů s méně než 5 kladnými či zápornými příklady, předpočítává pravé strany $X_{\text{uc}}^T y$ a čte výchozí návrhy přímo ze zamčených polí na zásobníku.
  - Návrhy tagů (`NavrhnoutTagy`, `navrhyZDetektoru`) čtou třídy detektoru přes pevné indexy bez lineárního prohledávání řetězců a počítají logity na zásobníku bez 228 000 alokací při průchodu sbírkou; skalární součiny ve `Vektory`, `Shlukovat` a Choleskyho rozkladu jsou 4× rozbalené a klíč mezipaměti kolekcí (`dataKolekci`) během aktivního výpočtu obsahu kvantuje počty po dávkách.

## [1.28.3] – 2026-11-09

### Opraveno
- **Výrazně nižší spotřeba CPU a RAM při výpočtu obsahu a učení**:
  - Během počítání vektorů fotek se přestala každé 2 sekundy od nuly přeučovat hřebenová regrese (Cholesky 531 × 531) přes všechny fotky; zjištění pokrytí v `GetPokrytiOdhadu` již odhady nepřepočítává a klíč mezipaměti odhadů a paměti příznaků se během běžícího výpočtu kvantuje po dávkách.
  - Každý JPEG náhled se při výpočtu obsahu dekóduje pouze jednou místo třikrát (společný `image.Image` pro CLIP, NudeNet i rozbor vzhledu) a předzpracování používá předalokované `image.RGBA` buffery bez mezipaměťového čtverce plného rozlišení.
  - Výpočet obsahu ustupuje aktivnímu oknu (`pockatNaKlid`) i tehdy, když jsou náhledy již v diskové mezipaměti.
  - Český jazykový model (`TextovyModel`) se po 5 minutách nečinnosti automaticky uvolní z RAM (~75 MB), převod `.safetensors` čte tenzory proudově po jednom bez 400MB špičky, násobení int8 matic recykluje pracovní buffery a škáluje počet gorutin podle délky dotazu.
  - Mapy partií a vzhledu používají hodnotová pole `[18]uint8` (nula pointerů pro GC) a `spocitatDataKolekci` čte příznaky dávkově přes `ProjitObsah` bez 38 000 zamčení mutexu a alokací sliců.
- **Svižnější vykreslování, rolování a uvolňování paměti v rozhraní**:
  - Odstraněno kvadratické $O(N^2)$ přepojování `IntersectionObserver` při dávkovém vykreslování karet a fotek v Galerii a Profilech (`sledovatDalsi` se `WeakSet` místo opakovaného `nacitatPostupne`).
  - Rozmazané pozadí záhlaví (`.ph-rozmazane` s `blur(40px)`) používá malý náhled `w400` místo 4K `w3840` textury; při opuštění Galerie fotek se zastaví časovač střídání záhlaví a odpojí pozorovatel mozaiky.
  - Odstraněny vnořené `backdrop-filter: blur(...)` nad již rozmazanými plochami a animace `min-height` záhlaví profilu, které brzdily rolování ve WebKit2GTK; doplněn debounce hledání v panelu filtrů, odpojování `ResizeObserver` ve Statistikách a čištění map v průvodci fotek.
- **Rychlejší obsluha náhledů, SQLite a statistických postřehů**:
  - HTTP server náhledů (`ServeHTTP`) proudově odesílá soubory z disku (`io.Copy`) bez alokace celých 4K souborů na haldě Go.
  - Odstraněn duplicitní průchod Bradleyho–Terryho modelu v `spocitatOblibenostUplne` a neporovnané modelky se vynechávají z iterací; sloučen N+1 dotaz v `GetNavrhyTagu` a doplněny paměťové pragmy pro `uceni.db`.
  - Zrychlen výpočet Kendallova $\tau_b$ (Fenwickův strom bez řazení dvojic v JS) a hledání zlomů a trendů ve Statistikách (sdílený `Intl.NumberFormat` a seřazené úseky).

## [1.28.2] – 2026-11-09

### Změněno
- **Statistiky: jen hero, rozšířený o pás postřehů.** Panel Postřehy pod herem je pryč (opakoval totéž co hero). Hero má pod scénou s fotkou pás karet se všemi průkaznými postřehy sbírky (graf, změna „0,65 → 0,68“, věta); zvolený je zvýrazněný a klik na kartu dá postřeh nahoru (místo tlačítka *Další postřeh ↻*). S výběrem pás ukáže, čím se výběr průkazně liší od sbírky; klik přepne graf a u hodnoty rozložení ji zvýrazní.

### Opraveno
- **Statistiky se přepočítávaly pořád dokola** (a brzdily start i celý program): načtení fotky záhlaví (`GetProfilovaFotka`) se počítalo jako zápis do databáze, takže každé vykreslení hera ohlásilo změnu dat a ta Statistiky přepočítala znovu. Teď je to čtení; u Profilů to zbytečně zahazovalo mezipaměti a spouštělo předpřípravu po každém heru.
- Otevřené Statistiky se po sérii zápisů přepočítají jednou, až po chvíli klidu; starší rozpracované vykreslení hera nepřepíše novější.
- Čísla v hlavičce Sbírky a Síně slávy byla od 1.28.0 velká a bílá (styl hera Statistik používal stejný název třídy).

## [1.28.1] – 2026-11-09

### Opraveno
- **Pomalý start, když byl program naposledy zavřený ve Statistikách**: úvodní obrazovka čekala na fotku hera v plném rozlišení (3 840 px), u nové modelky poprvé ze sítě – až 8 s navíc. Hero se teď doplní na pozadí (jako u Profilů), nejdřív s náhledem (800 px), a ostrá fotka se vymění, až se načte.
- Hero Statistik se při otevření vykresloval dvakrát (dvě stejná načtení fotky) a postřehy všech grafů se počítaly dvakrát (pro hero a pro panel); teď jednou.

## [1.28.0] – 2026-11-08

### Změněno
- **Statistiky jsou část Modelek**: Modelky › Profily · Galerie · **Statistiky** (dřív panel vpravo ve Sbírce). Vlastní stránka na celou šířku: nahoře **hero** jako u Profilů a Galerie s nejsilnějším postřehem sbírky – název údaje, velká změna (*„1 % → 35 %“*), věta postřehu a na pozadí nejlépe hodnocená modelka z období po změně, která danou vlastnost má; tlačítka *Ukázat v grafu*, *Další postřeh ↻* (postřehy se střídají i mezi spuštěními) a profil modelky z fotky. Pod ním panel Postřehy, graf a modelky výběru; volby grafu jsou jako dřív v liště pod hledáním, hledání najde modelku.
- Sbírka má v panelu vpravo už jen *Čísla a sháním* a *Učení*. Dřívější odkazy na Statistiky (nabídka sekcí, uložený panel, poslední otevřené místo) vedou do Modelky › Statistiky.

## [1.27.3] – 2026-11-08

### Přidáno
- **Panel Postřehy napříč grafy** (Postřehy ve Statistikách, krok 4): panel nad grafem je vidět i bez výběru – ukáže nejvýš 5 nejsilnějších zlomů a trendů ze všech grafů v čase (*„Od roku 1985 podíl modelek se silikonovými prsy průkazně vzrostl…“*, *„Od roku 1972 výška průkazně vzrostla…“*). S výběrem mají přednost rozdíly výběru, k nim nejvýš 2 zlomy nebo trendy výběru.
  - Řazení podle síly (Cliffovo δ / Cohenovo h) × jistoty (p po opravě); z příbuzných údajů (pas, poměr pas : boky, BMI · výška, váha, BMI · barva vlasů a blond) jen nejsilnější postřeh, každý graf jednou.
  - Bez přeskakování: postřeh, který byl vidět a zůstává mezi prvními 7, drží své místo i po změně výběru.
  - Klik na postřeh přepne na jeho graf; u hodnoty rozložení (např. národnost) ji v grafu zvýrazní rámečkem, výběr nezmění.

### Změněno
- Výpočty postřehů jsou rychlejší: Kendallovo τ a Mannův–Whitneyův test řadí typovaná pole (MW asi 5× rychleji), náklady úseků při hledání zlomů z dvojrozměrných kumulativních součtů. Postřehy všech grafů se přepočítají jen při změně edice, výskytu nebo podmínek výběru mimo rok.

## [1.27.2] – 2026-11-08

### Přidáno
- **Panel Postřehy: čím se výběr liší od sbírky** (Postřehy ve Statistikách, krok 3): když ve Statistikách vybereš rok, období nebo hodnotu (národnost, barvu vlasů, hodnocení…), nad grafem se ukáže až 5 vět o tom, čím se výběr průkazně liší – *„Ve výběru je víc modelek se silikonovými prsy: 42 % (celkem 14 %).“*, *„Výběr je o 3 cm vyšší (170 vs 167 cm).“*, *„Výběr má o 3 cm užší boky (86 vs 89 cm).“* Klik na větu přepne na graf toho údaje, bublina ukáže výběr, celou sbírku i zbytek, test a velikost rozdílu. Malý výběr (pod 10 modelek) nebo výběr bez rozdílu to řekne jedním šedým řádkem.
  - Srovnávají se všechny údaje a podíly z grafů a 8 nejčastějších hodnot kategorií, národností, barvy vlasů a očí, hodnocení a výskytu; výběr se testuje proti zbytku sbírky (Mann–Whitney, Fisher) s opravou Benjamini–Hochberg přes všechny testy. Věta jen při podstatném rozdílu (stejné prahy jako u trendu, Cliffovo δ nebo Cohenovo h aspoň 0,2). Co výběr sám určuje, se neříká (výběr podle vlasů nic o vlasech).
  - Na náhodných výběrech z nezávislé sbírky se postřeh ukáže asi u 3 % z nich; přepočet na 5 000 modelkách pod 15 ms.

## [1.27.1] – 2026-11-08

### Přidáno
- **Zlomy v grafech ve Statistikách** (Postřehy, krok 2): program najde roky, kdy se údaj nebo podíl skokem změnil, a řekne to větou – *„Od roku 1985 podíl modelek se silikonovými prsy průkazně vzrostl: z 1 % v letech 1954–1984 na 35 % v letech 1985–2021.“*, *„Od roku 1972 výška průkazně vzrostla: ze 165 cm v letech 1954–1971 na 170 cm v letech 1972–2021.“* V grafu je zlom čárkovaná svislice s rokem a přes období vede čára jejich úrovně (v legendě „úroveň období“). Zlom má přednost před větou o trendu; bublina u ⓘ ukáže všechna období s hodnotami a ověření každého zlomu.
  - Řada let se rozdělí optimálně (úsek aspoň 5 let a 30 modelek, nejvýš 3 zlomy) s pokutou za každý zlom nakalibrovanou simulací – na řadách bez zlomu najde falešný zlom asi u 2–3 %. Každý zlom se ověří testem sousedních období (Mann–Whitney, u podílu Fisher, oprava Benjamini–Hochberg) a musí být podstatný (stejné prahy jako u trendu); jinak se zahodí.

### Opraveno
- Hodnoty v postřezích mají pevný počet desetinných míst (poměr pas : boky „0,70“, ne „0,7“); BMI ve větě s jedním desetinným místem.

## [1.27.0] – 2026-11-08

### Přidáno
- **Postřeh o trendu pod grafem ve Statistikách** (téma Postřehy ve Statistikách, krok 1): u grafů údajů a podílů podle roku program sám řekne, jestli údaj skutečně roste nebo klesá – *„↗ Výška průkazně roste: ze 168 cm v 60. letech na 173 cm v letech 2010–2019.“*, *„Podíl modelek s tetováním průkazně roste: z 8 % v 80. letech na 41 % v letech 2010–2019.“* Při výběru jde o modelky výběru („ve výběru“). Bublina u ⓘ ukáže úrovně obou období (prostřední polovinu modelek nebo 95% interval podílu), tempo za 10 let, test a kolik modelek má údaj známý.
  - Věta se ukáže, jen když trend projde testem na úrovni modelek (Kendallovo τ_b rok × údaj, u podílu Cochranův–Armitageův test; p ≤ 0,05) **a** změna mezi prvním a posledním desetiletím s aspoň 10 modelkami je podstatná (výška, váha a obvody 2 cm/kg, věk 1 rok, BMI 0,5, poměr pas : boky 0,02, podíl 10 procentních bodů). Potřebuje aspoň 10 let a 60 modelek se známým údajem; jinak nic – raději žádný postřeh než náhoda.
  - Statistické funkce (`lib/statistika.js`) souhlasí se SciPy na sadě případů (`testdata/statistika-pripady.py`); na řadách bez trendu se postřeh v simulaci ukáže u 2–4 % z nich.

## [1.26.2] – 2026-11-08

### Opraveno
- **Tlačítka v banneru Profilů jsou v jedné řadě**: *🎯 Dnešní výběr* už nepadá na druhý řádek pod *Otevřít profil*, *Další tip* a *✨ Ideální modelka* (na úzkém okně se řada dál zalamuje).

## [1.26.1] – 2026-11-08

### Změněno
- **Důvod tipu „Mohlo by se ti líbit“ je věta, ne výčet údajů**: slovník převádí údaje, které odhad zvedají, na fráze ve správném tvaru (vlasy → „Blondýnka“, éra → „z 90. let“, národnost → „z Norska“, role → „byla Playmate měsíce“, výška → „měří 163 cm“, fotograf → „Fotil ji …“) a skladatel z nich složí souvětí: *„Blondýnka z 90. let, která měří 163 cm a má košíček D. Na jejích fotkách je to, co hodnotíš nejvýš. Podobá se modelkám, které se ti líbí: … Takhle vysoké tipy ti zatím sedí zhruba ve 3 ze 4 případů.“* Jako podobné se uvádějí jen modelky za ♥3+; nízký průměr srdíček fotek se do věty nedává (zněl jako důvod proti).

## [1.26.0] – 2026-11-08

### Přidáno
- **✨ Tvoje ideální modelka** (tlačítko v banneru Profilů a v bloku kolekcí Galerie): obrazně složená z fotek, které hodnotíš ♥4+ (♥5 váží dvakrát). U každé vlastnosti je, kolikrát častěji je mezi oblíbenými než v celé sbírce:
  - **Kdo to je** – vlasy, původ, éra, věk při focení, tetování, piercing, kariéra (jen vyhraněné preference);
  - **Co miluješ / Co tě míjí** – objevené styly, barvy a obsah fotek nejvíc nad a pod průměrem;
  - **Tvoje nejtypičtější fotka** (z oblíbených obsahem nejblíž středu vkusu) a **Objev** (nehodnocená, která ti sedí nejvíc);
  - **Modelky nejblíž tvému ideálu** (průměr jejich 3 nejbližších fotek).
  Vlastnost s kolekcí otevře kolekci v Galerii, modelka svůj profil, fotka prohlížeč.

### Změněno
- Nápověda hledání v Galerii zmiňuje i hledání podle obsahu („v kuchyni“, „Pamela na pláži“).

## [1.25.0] – 2026-11-08

### Změněno
- **Řady kolekcí v Galerii mají vlastní blok**: plocha s nadpisem *Kolekce pro tebe* (kolik řad, že se mění denně a podle toho, co otevíráš) a tlačítkem *▦ Všechny kolekce*, které otevře panel kolekcí a posune k němu; mozaika pod blokem má nadpis *Všechny fotky*. Je jasné, kde řady kolekcí začínají a končí.
- **Úvodní obrazovka bez výpisu pod sebou**: pod pruhem je jen jeden řádek s tím, co se právě děje, řada teček za kroky přípravy (název v bublině) a podrobnost posledního kroku („✓ Sbírka · 2 100 modelek“), k tomu „5 / 9 · 3,4 s“.

### Přidáno
- **Kolekce Galerie se připraví na úvodní obrazovce** (nový krok přípravy): data kolekcí, objevené styly a barvy se spočítají předem, první otevření Galerie tak nečeká ~1,5 s.

## [1.24.1] – 2026-11-08

### Změněno
- **Méně místa na zálohy**: denních záloh zůstává posledních 5 a k nim nejnovější ze 3 dalších týdnů (dřív 7 + 4); od ostatních důvodů (před importem, migrací, smazáním…) nejvýš 3 z posledních 30 dní, nejnovější od každého důvodu vždy (dřív až 20 od každého). U sbírky s 54 zálohami (243 MB) zůstane 24 (~140 MB); úklid proběhne s další zálohou.
- **Mezipaměť okna má limit**: obrázky, které si webové jádro okna ukládá na disk (`~/.cache/playboy-app/WebKitCache`), se samy neomezovaly a narostly přes 900 MB – jsou to z velké části zdvojené náhledy z vlastní mezipaměti. Nad 300 MB se při spuštění smažou a naplní se znovu z disku bez stahování.

## [1.24.0] – 2026-11-08

### Přidáno
- **Hledání slovy v Galerii (bod 5 návrhu kolekcí)**: když textu v hledání neodpovídá jméno modelky, album ani fotograf, Galerie hledá v obsahu fotek – „v kuchyni“, „červené auto“, „ve sněhu“, „černé punčochy“, „na koni“, „v telefonní budce“. Fotky jsou seřazené podle shody; ukážou se ty, které nad sbírkou výrazně vyčnívají, a nesmysly ani překlepy nevrátí nic. Jméno modelky v textu („Kelley Thompson na posteli“) omezí hledání na její fotky. Hovorová slova pro vlasy („zrzka“, „blondýnka“) se nahradí popisem, kterému model rozumí. V liště je štítek *🔎 V obsahu fotek*.
- Český textový model (vícejazyčný CLIP zúžený na češtinu, `alphaedge-ai/clip-ViT-B-32-multilingual-v1-cs-32768`, MIT) se stáhne jednou na požádání (*Zapnout hledání slovy*, ~274 MB s průběhem), převede na int8 (65 MB v `obsah/`) a běží přímo v Go bez internetu (~0,1–0,3 s na dotaz). Vypnutí obsahu fotek ho smaže.

## [1.23.0] – 2026-11-08

### Přidáno
- **Osobní pořadí řad kolekcí v Galerii**: program si pamatuje, které kolekce otevíráš (*Zobrazit vše*, *Celá kolekce* v banneru, dlaždice v panelu kolekcí, uložený výběr) a na které fotky v řadách klikáš, a takové kolekce dává výš (až ×1,6), spolu s celou jejich skupinou (až ×1,2 – kdo otevírá styly, uvidí víc stylů). Řada, která se ukazuje víc než 3 dny bez povšimnutí, pomalu klesá (až ×0,7). Zájem vyprchává s poločasem 30 dní. Často otevírané řady mají štítek *★ často otevíráš*.
- Ukládá se v nastavení databáze (`galerie_zajem`, nejvýš 300 kolekcí) – schéma ani formát exportu se nemění.

## [1.22.0] – 2026-11-08

### Přidáno
- **Panel kolekcí v Galerii** (tlačítko *▦ Kolekce* v liště vedle *☰ Filtry*): všechny kolekce najednou, ne jen 10 dnešních řad – po skupinách *Pro tebe*, *Čas*, *Objevené styly*, *Barvy a světlo*, *Obsah fotek*, *Vzhled modelek*, *Kariéra*, každá jako dlaždice s fotkou, která se ti z ní asi líbí nejvíc, a počtem fotek. Klik omezí mozaiku na kolekci (znovu klik na zvolenou ji zruší). Otevřený panel se pamatuje.
- **Uložené výběry**: *+ Uložit tento výběr* uloží pod názvem aktuální kombinaci kolekce, filtrů (srdíčka, typ alba, období, tagy) a řazení; v panelu se pak zapne jedním klikem (★ název, × smaže). Ukládá se v nastavení databáze – schéma ani formát exportu se nemění. Text hledání se do výběru neukládá.

## [1.21.0] – 2026-11-08

### Přidáno
- **Barvy a kvalita snímku (ML #2 návrhu kolekcí)**: obsah fotek nově u každé fotky spočítá z náhledu i její vzhled – podíly 12 odstínů, barevnost, jas, sytost, teplotu barev, kontrast a ostrost (~7 ms na fotku, bez modelu; `obsah/vzhled.bin`, 18 B na fotku). Při prvním spuštění se dopočítá pro celou sbírku na pozadí (náhledy většinou z disku, pár minut); stav obsahu fotek ukazuje průběh.
- **9 nových kolekcí v Galerii** (skupina „barvy“, nejvýš 3 řady denně): *V červené*, *V modré*, *V zeleni*, *Růžová a fialová*, *Sytě barevné* (mimo tóny pleti), *Teplé tóny* a *Chladné tóny* (5 % nejteplejších / nejchladnějších), *Měkký snový filtr* (soft focus) a *Vzory a textury* (nejvíc jemného detailu). Prahy ověřené na ukázkách z tvé sbírky; žluté (byla to hlavně zeleň na slunci) a pastelové (nespolehlivé) kolekce nejsou.

## [1.20.0] – 2026-11-08

### Přidáno
- **Objevené styly (ML #1 návrhu kolekcí)**: program sám rozdělí fotky sbírky podle obsahu do skupin (k-means nad vektory obrazového modelu, ~1 skupina na 300 fotek) a každé dá český název z ~85 popisů stylů (éry, prostředí, oblečení, světlo a nálada, záběr) – ten, který skupinu nejvíc odlišuje od ostatních. Vektory popisů jsou vestavěné (`internal/obsah/styly.bin`, generátor `tagy-clip -styly`), nic se nestahuje.
- Styly se počítají na úvodní obrazovce (~6 s na 19 000 fotek) jen poprvé a po přibytí 2 % fotek; ukládají se do `obsah/styly.json` vedle vektorů.
- Styly s aspoň 100 fotkami a dost jistým názvem jsou **kolekcemi v Galerii** (skupina „styl“, nejvýš 3 řady denně) – např. Šedesátky, Černé prádlo, Luxusní ložnice, Slunná pláž, Auta, Neon, Černobílé. Názvy ověřené proti nezávislým návrhům tagů (Auta 82 %, Slunná pláž 58 %, Černobílé 40 % proti 0,7 % ve sbírce).

## [1.19.0] – 2026-11-08

### Přidáno
- **Kolekce ze strojového učení (etapa 4 návrhu kolekcí)** nad spočítaným obsahem fotek:
  - **Nejlepší snímek každého focení** – z každého alba jedna fotka (nejvíc srdíček, jinak nejvyšší odhad z obsahu);
  - **Focení, která jsi ještě nehodnotil** – alba bez srdíček s nejvyšším průměrným odhadem (horních 15 %), z každého jedna fotka;
  - **Mimo tvou bublinu** – fotky tvých oblíbených modelek (♥4+), které se obsahem nejvíc liší od tvých ♥4+ fotek (nejvzdálenější pětina od „středu vkusu“).
- **Téměř stejné snímky v řadách jen jednou**: dva skoro stejné záběry (podobnost obsahu ≥ 0,95, různé ořezy, sousední snímky) se v řadě kolekce neukážou vedle sebe – řada je pestřejší.

## [1.18.2] – 2026-11-08

### Opraveno
- **Šipky v banneru Galerie překrývaly text**: levá šipka ležela přes nadtitulek kolekce. Šipky jsou teď dole vpravo u čárek (‹ čárky ›), menší a vidět stále; text vlevo zůstává volný.

## [1.18.1] – 2026-11-08

### Přidáno
- **Kolekce „N let v době focení“**: modelky stejně staré v době focení – věk z data narození a data alba (jinak čísla), před narozeninami o rok méně; každý den jiný věk (z těch s aspoň 30 fotkami). Výročí úmrtí se jako kolekce nedělá (rozhodnutí 8. 11. 2026).

## [1.18.0] – 2026-11-08

### Přidáno
- **Kolekce v Galerii (etapa 1 návrhu `docs/NAVRH-GALERIE-KOLEKCE.md`)**: pod bannerem 10 řad sdružených fotek jako ve streamovacích službách – každá s názvem, důvodem, počtem, vodorovným pásem 15 fotek (šipky, klik otevře fotky řady v prohlížeči) a *Zobrazit vše*, které omezí mozaiku na kolekci (štítek *Kolekce: …* s křížkem v liště). Kolekce program skládá sám:
  - **čas**: tento měsíc v historii, výročí (před 10–50 lety v tomto měsíci), rok a desetiletí dne, narozeniny modelek tento týden, nově přidané;
  - **vzhled** (údaje modelek): blondýnky, brunetky, černovlásky, zrzky, oblast původu podle národnosti (bez etnicity), tetování, piercing;
  - **kariéra**: centerfoldy, Playmate roku, online pictorialy, dua a skupiny, fotograf dne;
  - **tvoje hodnocení**: tvoje ♥5, Top 10, skryté poklady (horních 10 % nehodnocených podle odhadu z obsahu);
  - **obsah fotek** (tagy i návrhy obrazových modelů): pláž, bazén, studio, koupelna, příroda, auta, bikiny, podpatky, latex, šaty, džíny, zlatá hodina, noir, světlé, černobílé.
- Každý den se vybere 10 řad podle toho, jak se ti fotky v kolekci asi líbí, velikosti, kalendáře a denní obměny (nejvýš 3 z jedné skupiny); kolekce pod 8 fotek nebo přes 60 % sbírky se neukazují. Fotky v kolekci jsou seřazené jako *Co se ti asi líbí* a promíchané napříč alby.
- **Banner přes kolekce**: nadtitulek je název kolekce, fotka její nejlepší, tlačítko *Celá kolekce*.

## [1.17.3] – 2026-11-08

### Přidáno
- **Listování bannerem Galerie zpět i dopředu**: po stranách banneru šipky ‹ › (ukážou se při najetí myší), s myší nad bannerem i klávesy ← →; posouvají v kruhu přes 8 nabízených fotek.

## [1.17.2] – 2026-11-08

### Změněno
- **Banner Galerie jako ve streamovacích službách**: místo pásu náhledů čárky vpravo dole (8 fotek z čela výběru). Banner se každých 8 s plynule prolne na další fotku a aktivní čárka se postupně plní průběhem; najetí myší přepínání zastaví (i průběh), klik na čárku ukáže danou fotku. Když Galerie není vidět, banner nepřepíná.

## [1.17.1] – 2026-11-08

### Změněno
- **Banner Galerie nabízí fotky, ne modelku**: nadpis je album nebo číslo, jméno modelky je menší odkaz na profil pod ním; nadtitulek říká, proč tu fotka je (*Tvoje ♥♥♥♥♥*, *Podle obsahu by se ti mohla líbit*, *Nově přidaná*…). Vpravo dole pás šesti dalších fotek z čela výběru – najetí myší fotku ukáže velkou, klik ji vybere; *Další ↻* posune na další fotku.

## [1.17.0] – 2026-11-08

### Změněno
- **Galerie jako Profily: hero banner a široká lišta**: nahoře banner s jednou z fotek z čela výběru (střídá se, *Další ↻*) – modelka, srdíčka fotky, album – a tlačítka *Otevřít fotku*, *Profil modelky*, *Podobné fotky*. Pod ním široká lišta: Zobrazit (Všechny fotky, ♥3+/4+/5, vlastní výběry), řazení, *☰ Filtry*, štítky zapnutých filtrů s křížkem, počet fotek a *▶ Slideshow*. Úzký panel vpravo a kapsle nahoře jsou pryč.
- **Filtry jako široký pás pod lištou** (☰ Filtry ho rozbalí, pamatuje se): srdíčka fotky, typ alba, období a tagy po skupinách s počty fotek; *zrušit všechny filtry*. Při hledání se banner neukazuje.

## [1.16.2] – 2026-11-08

### Změněno
- **Hero banner Profilů zpět ve stránce nad kartami** (jako v 1.16.0): verze s bannerem v hlavičce okna (1.16.1) je vrácená.

## [1.16.1] – 2026-11-08

### Změněno
- **Hero banner Profilů v hlavičce okna**: banner s doporučenou modelkou a lišta ovládání (řazení, Filtry, štítky filtrů) jsou součástí panelu hlavičky pod tlačítky menu – stejně jako záhlaví profilu modelky, ne nad kartami ve stránce. Po odrolování se banner svine a v hlavičce zůstane lišta; nahoře na stránce se zase rozbalí.

## [1.16.0] – 2026-11-08

### Změněno
- **Profily s hero bannerem**: nahoře na Profilech je filmový banner s doporučenou modelkou – střídavě tip *Mohlo by se ti líbit* (s důvodem odhadu) a modelka z tvého Top 10 – velká fotka (fotka záhlaví, jinak fotka karty), jméno, srdíčka nebo odhad a tlačítka *Otevřít profil*, *Další tip ↻* a *🎯 Dnešní výběr*. Každé spuštění začne dalším tipem; při hledání se banner neukazuje. Karty pod ním zůstávají čisté.
- **Široká lišta ovládání místo kapsle vpravo nahoře**: řazení, tlačítko *☰ Filtry* (panel filtrů pod ním) a zapnuté filtry jako štítky s křížkem (klik na štítek otevře jeho úpravu), vpravo počet modelek.

## [1.15.1] – 2026-11-08

### Opraveno
- **Galerie se otevírala ve starém pohledu ♥3+**: dřív uložená volba prahu srdíček měla přednost před novou galerií všech fotek. Jednou se přepne na *Všechny fotky*; ♥3+/4+/5 zůstávají v nabídce, která se teď jmenuje *Zobrazit* (dřív *Srdíčka*, „Všechny fotky“ v ní nebylo poznat).
- **Mozaika ♥3+ po úrovních ukazovala jen první úroveň**: pod ní visela tlačítka „Zobrazit další fotky“ bez fotek. Každá úroveň teď hned ukáže první dávku.

## [1.15.0] – 2026-11-08

### Změněno
- **Profily: připnutý panel filtrů**: panel Filtry (srdíčka, edice, kategorie, vlasy, rok vydání…) jde *Připnout vedle karet* – zůstane otevřený vpravo jako panel Údaje v profilu modelky, karty se odsunou, klik mimo ho nezavře a otevře se sám, kdykoli jsou Profily vidět (pamatuje se; *Odepnout* vrátí plovoucí panel pod tlačítkem).
- **Přehlednější karty modelek**: karta ukazuje jen fotku, jméno, srdíčka a u nehodnocené odhad; odznak Top 10/20 a šipka trendu zmizely (pořadí a trendy jsou v Hodnocení).

## [1.14.0] – 2026-11-08

### Přidáno
- **Galerie: všechny fotky napříč modelkami**: Modelky › Galerie ukazuje výchozí volbou *Všechny fotky* celou sbírku (dřív jen fotky ♥3+) jako jednu mozaiku, po stránkách 300 fotek (další se načítají při rolování). Výchozí řazení *Co se ti asi líbí* – tvoje srdíčka a u nehodnocených odhad z obsahu fotek, promíchané napříč alby (z jednoho alba nejvýš 2 fotky z 12 po sobě); dál *Nejlepší* (srdíčka × oblíbenost modelky), *Nejnovější* a *Náhodně*.
- **Ovládací panel galerie** vpravo (jako panel Údaje v profilu, tlačítko *☰ Řazení a filtry*, pamatuje se): řazení, srdíčka fotky (♥3+/4+/5, bez srdíček), typ alba, období (desetiletí) a tagy po skupinách – u každé hodnoty počet fotek, které zbudou; *zrušit filtry*. Text v hledání omezuje galerii (jméno modelky, album, fotograf). ♥3+/4+/5 po úrovních hodnoty a vlastní výběry zůstávají jako volby nad mozaikou.

## [1.13.1] – 2026-11-08

### Změněno
- **Dnešní výběr: víc fotek každé modelky**: místo tří fotek deset z různých alb (podle toho, co se ti podle obsahu asi líbí; bez titulní fotky karty); najetí myší na malou fotku ji ukáže velkou, takže si modelku prohlédneš dřív, než vybereš. Název alba je v nápovědě malé fotky.
- **Věta pod kartami pro čtveřici**: místo věty o dvojici („Obě mají…“) říká, o co ve volbě jde – zařazení nových modelek, hranice Top 10/20/50/100 („modelky od 17. do 24. místa – vítězka má nejblíž k Top 20“), všechny se stejnými srdíčky, nebo modelky s podobnou oblibou.

## [1.13.0] – 2026-11-08

### Přidáno
- **Dnešní výběr – porovnávání po čtveřicích**: místo nekonečných soubojů dvojic krátká denní dávka 10 voleb (~2 minuty) „Která se ti líbí nejvíc?“ – čtyři modelky vedle sebe, každá s velkou fotkou a dvěma menšími (vybranými podle toho, co se ti podle obsahu fotek asi líbí). Jedna volba zapíše tři porovnání (vítězka proti každé ze tří), takže na stejné zpřesnění pořadí stačí asi třetina kliknutí. Čtveřice skládá výběr dvojic aktivním učením (nejistá a důležitá místa pořadí, nezařazené modelky) doplněný modelkami s nejbližší silou, aby volba byla vyrovnaná. Klávesy 1–4, Backspace vrátí poslední volbu, Esc skončí. Po dávce shrnutí, kdo se v pořadí posunul (klik otevře profil), a *Dalších 10*. Volby se počítají do dnešního postupu a série v Hodnocení.
- **Kartička po spuštění**: po úvodu se vpravo dole objeví nenápadná nabídka dnešního výběru s konkrétním lákadlem („Kdo bude desátá v Top 10 – A, nebo B?“, „12 nových modelek čeká na zařazení“); jednou denně, dokud není dávka hotová, křížek ji na dnes schová.
- Dnešní výběr je i v Hodnocení › Porovnat (tlačítko 🎯 s postupem) a v nabídce ⋯.

## [1.12.2] – 2026-11-08

### Změněno
- **Fotky záhlaví v plném rozlišení na disku**: fotka záhlaví profilu se stahuje do 3 840 px šířky (Disk fotky nezvětšuje, takže je to u naprosté většiny originál) a ukládá se do mezipaměti náhledů na disku (limit souboru 32 MB místo 4 MB). Podruhé je záhlaví ostré hned, i bez připojení. Stahování náhledů na pozadí na konci stáhne i fotky záhlaví všech modelek, které ji mají. Prohlížeč fotek (originály) se nemění.

## [1.12.1] – 2026-11-08

### Opraveno
- **Srdíčka modelky v záhlaví profilu nešla nastavit**: obsluha kliknutí na srdíčka modelky poslouchala jen v hlavní části okna, ale pruh se jménem a srdíčky je v hlavičce okna. Klik teď funguje i v záhlaví (i ovládání klávesami 1–5, šipky, Home, End na zaměřených srdíčkách); karta v galerii, Oblíbenost i odhad se přepíšou stejně jako dřív.

## [1.12.0] – 2026-11-08

### Změněno
- **Úvodní obrazovka v malém okně**: program se otevře jako malé okno 460 × 580 px uprostřed obrazovky – jen logo (nebo kruh profilovek, zmenšený), krok, seznam přípravy, čas a tlačítko. Na konci úvodu dostane okno uloženou velikost a polohu (nebo se maximalizuje, jak bylo naposledy); se zámkem už před oknem s heslem. Zavření programu během úvodu malé okno neuloží.

## [1.11.1] – 2026-11-08

### Změněno
- **Fotka záhlaví v plném rozlišení**: záhlaví ukazovalo náhled 800 px roztažený přes ~1 600 px šířky (měkký, s kompresí). Teď se hned ukáže náhled z mezipaměti a po stažení ho nahradí originál z Disku (=s0); rozostřené pozadí zůstává na náhledu.

## [1.11.0] – 2026-11-08

### Změněno
- **Fotka karty a fotka záhlaví** místo „titulní“ a „profilové“: v akcích fotky *Nastavit jako fotku karty* (karta v galerii a panel Údaje) a *Nastavit jako fotku záhlaví* (záhlaví profilu); stejné názvy mají úpravy výřezu a hlášení.
- **Záhlaví si nepůjčuje fotku karty**: nastavení fotky karty už nemění záhlaví. Modelka bez fotky záhlaví má nižší záhlaví (200 px) bez fotky a v řádku kariéry odkaz *+ fotka záhlaví*, který poradí, jak ji vybrat.
- **Pravé tlačítko na záhlaví nabízí jen fotku záhlaví** (upravit výřez, odebrat; bez ní návod, jak ji vybrat) a akce s modelkou – výřez fotky karty tam už není. Tlačítko ⋯ ukazuje obě fotky oddělené nadpisy *Fotka záhlaví*, *Fotka karty* a *Modelka*.
- **Fotka na výšku vyplní záhlaví**: záhlaví se fotce nepřizpůsobuje (dřív portrét zabral jen úzký pruh vpravo); fotka na výšku i na šířku zabere 82 % šířky a přechází do pozadí pod textem, výřez určí, která část je vidět (výchozí nahoře, u obličeje).

## [1.10.4] – 2026-11-08

### Změněno
- **Záhlaví profilu bez prázdných míst**: fotka na šířku zabere 82 % šířky banneru (dřív 68 %) a do pozadí přechází jen pod textem vlevo – nad jménem už nezůstává velká tmavá plocha.
- **Bez centerfoldu není tlačítko Centerfold** (vypnuté vypadalo skoro jako ostatní akce a zabíralo místo).
- **Drobeček se jménem modelky neutrálně** (bílý text bez růžového podkladu): jméno je hned pod ním velkým písmem a růžová zůstává hlavní akci a zvolenému albu.

## [1.10.3] – 2026-11-08

### Změněno
- **Záhlaví profilu oddělené od lišty alb**: mezi jménem s řádkem kariéry a lištou alb je mezera (22 px místo 10 px), lišta alb už nepůsobí jako součást jména; po odrolování zůstává pruh kompaktní.

## [1.10.2] – 2026-11-08

### Změněno
- **Čísla časopisu a „Online“ v záhlaví profilu jako text**: růžové pásky pod jménem splývaly s lištou alb a rušily ji. Teď jsou součástí řádku kariéry („1999–2003 · 6 alb · 214 fotek · Playmate · Říj 98, Led 00, Online“) jako textové odkazy – klik dál otevře číslo nebo přejde na online album, při najetí se zlatě podtrhnou.

## [1.10.1] – 2026-11-08

### Změněno
- **Záhlaví profilu doladěné podle skutečného vzhledu**: nižší (~40 % okna, nejvýš 460 px místo 46 % a 520 px), takže fotky alb začínají výš; rozostřená kopie fotky vlevo je tmavší a skoro bez barvy (dřív hnědá šmouha), ostrá fotka víc vynikne; pásky čísel menší (Online, Playmate…), aby nepřebíjely jméno.

## [1.10.0] – 2026-11-08

### Změněno
- **Souboje ukazují modelku tím, co se ti asi líbí**: fotky v porovnání se u nehodnocených fotek řadí podle odhadu srdíček z obsahu (dřív podle pořadí v albu), alba bez hodnocených fotek podle nejlepšího odhadu a z téměř stejných záběrů (podobnost obsahu ≥ 0,93) se vezme jen jeden – souboj tak ukáže víc různých focení a póz místo série skoro stejných snímků. Po spočítání dalšího obsahu se náhledy vyberou znovu.
- **Nehodnocená modelka bez odhadu vkusu** (málo údajů) se do souboje staví na úroveň podle obsahu jejích fotek (převedeno na srdíčka přímkou z hodnocených modelek), ne na průměr sbírky; důvod dvojice to řekne („Podle obsahu jejích fotek vychází na…“). Modelky s odhadem vkusu se to netýká – ten obsah fotek obsahuje od 1.6.0.

## [1.9.0] – 2026-11-07

### Změněno
- **Záhlaví profilu jako filmový banner**: nahoře na stránce je záhlaví vysoké ~46 % okna (300–520 px). Ostrá fotka stojí vpravo v celé výšce – fotka na výšku se ukáže celá v rámu 4 : 5 (už se neořezává do širokého pruhu, kde z ní zbylo čelo), na šířku zabere dvě třetiny – a měkce přechází doleva do rozostřené kopie téže fotky a dole do stránky. Modelka bez profilové fotky má v záhlaví titulní fotku, záhlaví už nezůstává prázdné.
- **Text pohromadě dole vlevo**: nadtitulek s kategoriemi (zlatě), velké jméno se srdíčky, řádek kariéry (roky, počet alb a fotek, pořadí v oblíbenosti, odhad, odznaky) a pod ním pásky čísel; akce vpravo dole, lišta alb pod tím. Dřív byly pásky nahoře vpravo, jméno dole a akce zvlášť.
- Po odrolování se záhlaví zmenší na kompaktní pruh se jménem a akcemi. V úzkém okně je fotka přes celou šířku za textem. Úprava výřezu profilové fotky se dělá v rámu ostré fotky.
- Styly záhlaví sjednocené do jednoho bloku (dřív čtyři vrstvy úprav z verzí 1.2.59–1.2.72, které se přepisovaly).

## [1.8.1] – 2026-11-07

### Opraveno
- **Řazení *Co se ti asi líbí* až s dost odhady**: nabízelo se, jakmile měl obsah spočítaný aspoň 200 hodnocených fotek – výpočet ale jde od nejlépe hodnocených, takže většina nehodnocených fotek odhad ještě neměla a fronta byla z větší části jen zamíchaná. Nově se řazení nabídne, až má odhad aspoň 80 % nehodnocených fotek; nápověda tlačítka říká, kolik fotek odhad má („odhad má 15 100 z 15 100 nehodnocených fotek“).
- **Odhad u fotky v Průvodci**: značka zpracované fotky ukazuje i *odhad ♥3,4* (odhad srdíček podle obsahu a tvého vkusu); bez odhadu nápověda vysvětlí proč. Odhady jsou v paměti, dokud se nezmění srdíčka fotek nebo spočítaný obsah.

## [1.8.0] – 2026-11-07

### Změněno
- **Propracovaná úvodní obrazovka**: pod pruhem je seznam kroků přípravy – Databáze, Sbírka, Galerie a náhledy, Obrazové modely, Oblíbenost a sezóna, Odhady z obsahu fotek, Mohlo by se ti líbit, Ostatní pohledy – s tím, co právě běží (pulzující tečka), co je hotové (✓) a podrobnostmi (počet modelek, kolik fotek má spočítaný obsah, z kolika fotek Průvodce se učí a kolik tagů už navrhuje podle tebe); dole běží čas přípravy. V nízkém okně zůstane jen pruh.
- **Program naběhne připravený**: úvod teď počká i na to, co se dřív dělalo až za chodu – náhledy první obrazovky (až 8 s místo 2,5 s), oblíbenost a sezónu (bez časového limitu), odhad srdíček z obsahu fotek a obsah fotek modelek, učení tagů z Průvodce, „Mohlo by se ti líbit“ a mezipaměti Sbírky, Čísel, hledání, Statistik a volby sezóny. Start trvá déle, ale první otevření pohledů už nečeká. Po 6 s jde zbytek *Přeskočit* (doběhne za chodu); nejdéle 60 s, pak úvod zmizí sám.

## [1.7.0] – 2026-11-06

### Přidáno
- **Průvodce se učí z tvých voleb**: každá fotka, kterou v Průvodci projdeš, je příklad – co jsi zvolil, na fotce je, a co jsi ve stejném kroku nezvolil, na ní není. Program se z nich pro každý tag naučí, jak taguješ ty (nad tím, co o fotce spočítaly obrazové modely), a přeučí se na pozadí po každých 10 fotkách. Naučený tag nahradí dosavadní návrh, až má aspoň 5 příkladů s tagem i bez něj a na ověření rozhoduje lépe než dosavadní návrh – tag po tagu tak návrhy přecházejí na tvůj vkus (i tagy, které obrazové modely samy nepoznají: punčochy, zaječí uši, výraz…).
- V hlavičce Průvodce je u zpracované fotky *podle tebe N* (kolik návrhů rozhodlo učení) a v nápovědě značky, z kolika fotek se učí a kolik tagů už rozhoduje podle tebe. Popis v `docs/MODEL-CLIP-B32.md`, oddíl 10.

## [1.6.0] – 2026-11-06

### Změněno
- **Odhad srdíček fotek i z detektoru partií**: řazení *Co se ti asi líbí* v Rychle ♥ bere kromě obsahu fotky (CLIP) i to, co detektor na fotce našel (odhalení, partie). Na fotkách cizích modelek mírně přesnější (Spearman 0,44 → 0,46).
- **„Mohlo by se ti líbit“ s obsahem fotek**: model vkusu má nový údaj *obsah fotek* – jak by se ti podle obrazových modelů líbily fotky modelky. Pomáhá hlavně u nehodnocených modelek bez ohodnocených fotek (na kopii sbírky chyba odhadu 0,726 → 0,698, přesnost 58 → 60 %); kolik mu věřit, rozhoduje ověření modelu vkusu. Údaj se může objevit i v důvodu tipu. Měření v `docs/MODEL-CLIP-B32.md`, oddíl 9.

## [1.5.0] – 2026-11-06

### Přidáno
- **Odhalení a partie poznává detektor**: obecný obrazový model CLIP nepoznal, jestli je modelka oblečená, v prádle, nahoře bez, nebo nahá – proto se tyto tagy dosud vůbec nenavrhovaly. Nově se stahuje i specializovaný detektor partií NudeNet 320n (12 MB, ověřený SHA-256; licence AGPL-3.0). Úvodní obrazovka ho u stávající instalace stáhne sama a výpočet na pozadí ho doplní ke všem fotkám (64 ms na fotku).
- Průvodce teď navrhuje **Odhalení** (akt, nahoře bez, prádlo / plavky, oblečená) a **Partie** (prsa, zadeček, vagina, chodidla). Explicitní akt detektor neodliší a nenavrhuje se. Ostatní návrhy (prostředí, oblečení, světlo…) zůstávají z CLIP.
- U fotky v Průvodci je *◎ zpracovaná*, až má hotový CLIP i detektor. Pravidla a měření v `docs/MODEL-CLIP-B32.md`, oddíl 8.

## [1.4.1] – 2026-11-06

### Přidáno
- **Průvodce ukazuje stav obsahu fotky**: v hlavičce pásku je vidět, jestli je fotka zpracovaná obrazovým modelem (*◎ zpracovaná · 2* = počet navržených tagů s obrysem), nebo na výpočet teprve čeká (*◌ čeká na zpracování* s průběhem výpočtu); bez staženého modelu *◌ bez modelu*. Je tak jasné, proč fotka žádný návrh tagů nemá.

## [1.4.0] – 2026-11-06

### Přidáno
- **Odhad srdíček z obsahu fotek**: z vektorů hodnocených fotek se program naučí, co se ti na fotkách líbí (hřebenová regrese + odchylka alba), a odhadne srdíčka nehodnocených. Rychle ♥ má nové řazení **Co se ti asi líbí** – nejdřív fotky s nejvyšším odhadem. Na vzorku sbírky seřadil fotky podle tvých srdíček výrazně líp než průměr alba (Spearman 0,58 proti 0,41; z fotek s odhadem ♥2,5+ jich 70 % má ♥3+). Objeví se, až má vektor aspoň 200 hodnocených fotek.
- **Návrhy tagů z obsahu fotky v Průvodci**: krok bez tagu (a bez návrhu z minulé fotky alba) se předvyplní tagem podle obsahu fotky – obrys = návrh, Enter ho převezme, číslice ho změní. Navrhují se jen tagy, které na vzorku sbírky obstály (prostředí, oblečení, postoj, černobílá, světlo, celá postava); tagy, které obrazový model bez tvých označených fotek neodhadne spolehlivě, se nenavrhují. Vektory popisů tagů jsou vestavěné (`internal/obsah/tagy.bin`, generátor `internal/obsah/tagy-clip`), nic dalšího se nestahuje.
- Měření v `docs/MODEL-CLIP-B32.md`, oddíl 7.

## [1.3.1] – 2026-11-06

### Změněno
- **Obsah fotek bez zapínání**: model už se nezapíná v nabídce. Úvodní obrazovka zkontroluje, jestli je model obsahu fotek stažený; když chybí, stáhne ho s průběhem přímo v úvodu (po 4 s nabídne *Pokračovat, stáhnout na pozadí*; bez připojení se start nezdrží a zkusí se příště). Výpočet vektorů všech fotek se pak spustí sám a běží na pozadí (poprvé ~1,5 h); se staženým modelem se minutu po startu dopočítají nové fotky. ✕ ve stavové liště výpočet pozastaví do příštího spuštění. Položky *Zapnout/Vypnout podobné fotky* jsou pryč.

## [1.3.0] – 2026-11-06

### Přidáno
- **Podobné fotky (obsah fotek, etapa 1)**: v nabídce ⋯ (Soubory a mezipaměť) jde zapnout *Podobné fotky*. Program po potvrzení stáhne obrazový model CLIP ViT-B/32 a ONNX Runtime (~100 MB, ověřené SHA-256) a na pozadí spočítá obsah **každé fotky sbírky** z náhledu w400 (chybějící náhledy se stáhnou ohleduplně jako náhledy na pozadí). Průběh je ve stavové liště (✕ pozastaví) a v nabídce; spočítané se ukládá po 500 fotkách a po přerušení se pokračuje. Pak má každá fotka v akcích (⋯, pravé tlačítko, prohlížeč) položku **Podobné fotky**: prohlížeč ukáže 48 nejpodobnějších fotek sbírky (stejné focení, scéna, téměř stejné snímky), původní fotka je první. Po startu se dopočítají nové fotky. *Vypnout podobné fotky…* smaže model i vektory.
- Vše běží místně, fotky nikam neodcházejí. Vektory jsou v `obsah/vektory.bin` vedle databáze (~10 MB pro 18 000 fotek), ne v databázi: **beze změny schématu i exportu**. ONNX Runtime se načítá až za běhu, sestavení programu nic nového nepotřebuje.
- Předzpracování je shodné s měřením v `docs/MODEL-CLIP-B32.md` (celá fotka 224 × 224, CatmullRom); test porovnává vektor s referencí prototypu (`OBSAH_SLOZKA=… go test ./internal/obsah`).

## [1.2.73] – 2026-11-06

### Přidáno
- **Příprava obsahu fotek (zatím bez rozhraní)**: nový balíček `internal/obsah` stahuje obrazový model CLIP ViT-B/32 (89 MB) a knihovnu ONNX Runtime 1.31.1 (z archivu 11 MB) po blocích rovnou na disk, s průběhem, navázáním po přerušení (hlavička Range) a ověřením SHA-256 vestavěného v programu; poškozený soubor se smaže. Návrh v `docs/NAVRH-OBSAH-FOTEK.md`, zjištění o modelu v `docs/MODEL-CLIP-B32.md`. Program se zatím nemění: nic se nestahuje, dokud funkce nedostane nastavení.

## [1.2.72] – 2026-11-06

### Změněno
- **Záhlaví profilu s fotkou v originále**: fotka v záhlaví už nemá žádné filtry ani úpravy barev (bez holografie, třpytek, odlesku i ztmavení), čitelnost textu drží stín písma. Jméno je jednou barvou. Zůstává zlatý lem dole; jeho barvy jsou ve společných proměnných `--zlato-*`, aby šly použít i jinde.
- **Přehlednější panel Údaje**: pod velkou titulní fotkou jsou další jména a kategorie jako štítky; bloky Playboy, Osobní, Vzhled, Články, O modelce, Tagy a Odkazy mají jednotné nadpisy a jsou zarovnané vlevo. Tagy zabírají nejvýš dva řádky (s počtem v nadpisu), zbytek rozbalí *Všechny tagy*.
- **Text O modelce s formátováním**: poznámka modelky se v panelu čte jako krátký článek – mezititulky (`#`, `##`, `###`), tučné písmo a kurzíva, seznamy s růžovými odrážkami a citace s růžovou linkou; bez rámečku a šedého písma.

## [1.2.71] – 2026-11-06

### Změněno
- **Záhlaví profilu jako holografická sběratelská karta** (místo křídového papíru z 1.2.69–1.2.70): přes fotku je duhová holografie jako u lesklých karet, měkký odlesk světla a řídké třpytky. Při pohybu myši nad záhlavím se duha, odlesk i třpytky přelévají, jako když se karta natáčí pod světlem. Jméno modelky je zlatou fólií a dole vede tenký zlatý lem jako rámeček zlaté karty. Při úpravě výřezu jsou efekty vypnuté; se zapnutým omezením animací v systému zůstane duha v klidu.

## [1.2.70] – 2026-11-06

### Změněno
- **Záhlaví profilu: méně zrna, víc kovového lesku**: zrno papíru je zhruba poloviční a přes fotku vedou dva pevné šikmé pruhy světla jako na lakovaném archu pod lampou (vlevo teplý šampaňský, vpravo chladnější stříbrný). Lesk zvedá světla a prohlubuje stíny, takže povrch působí kovově; nic se nehýbe. Při úpravě výřezu je lesk vypnutý.

## [1.2.69] – 2026-11-06

### Změněno
- **Záhlaví profilu jako křídový papír**: fotka v záhlaví má tiskový tón (o kousek víc kontrastu, teplá krémová světla), přes ni jemné zrno papíru a slabý pevný saténový odlesk laku vlevo nahoře; pod záhlavím je měkký stín. Nic se nehýbe ani nesleduje myš; fotky v databázi se nemění (jde jen o zobrazení). Při úpravě výřezu jsou efekty vypnuté, aby byla vidět skutečná fotka.

## [1.2.68] – 2026-11-06

### Změněno
- **Nové rozložení záhlaví profilu**: jméno se srdíčky, pořadím, tituly a odznaky je dole vlevo nad lištou alb jako titulek fotky (větší písmo), akce jsou vpravo na stejné úrovni a pásky čísel (Playmate, Cybergirl) nahoře vpravo naproti drobečkům. Střed záhlaví tak zůstává volný pro fotku. Po odrolování je záhlaví nižší (jméno i akce v jednom pásu); v úzkém okně se akce zalomí pod jméno.

## [1.2.67] – 2026-11-05

### Opraveno
- **Úprava výřezu profilové fotky v záhlaví přesouvala celé okno**: záhlaví slouží k přesouvání okna, při úpravě výřezu teď tažení posouvá fotku. Po uložení nebo zrušení úpravy jde okno záhlavím přesouvat jako dřív.

## [1.2.66] – 2026-11-05

### Změněno
- **V záhlaví profilu jen jedna fotka**: místo rozmazané kopie přes celou šířku a ostré fotky vpravo je profilová fotka jednou přes celé záhlaví. Její výřez (*Upravit výřez profilové fotky*) se upravuje přímo v širokém záhlaví, takže jde vybrat přesně tu část fotky, která má být vidět.

## [1.2.65] – 2026-11-05

### Změněno
- **Profilová a titulní fotka úplně oddělené**: záhlaví profilu ukazuje jen profilovou fotku (bez ní zůstane bez fotky), karta v galerii, náhledy a panel Údaje jen titulní. Každá má vlastní výřez: *Upravit výřez titulní fotky* v panelu Údaje, *Upravit výřez profilové fotky* přímo v záhlaví (fotka v něm na dobu úpravy vystoupí nad jméno a akce).

### Databáze a export (výjimka ze zmrazení na přání uživatele)
- **Úprava schématu č. 16**: profilová fotka a její výřez jsou nově ve sloupcích tabulky modelek (`profil_fotka_id`, `profil_zoom`, `profil_x`, `profil_y`); smazaná fotka profilovou fotku zruší. Profilové fotky uložené v 1.2.63–1.2.64 mezi nastaveními se přenesou. Před úpravou se databáze sama zazálohuje; starší verze programu ji pak otevře jen pro čtení.
- **Export verze 13**: u modelky přibyly `profilova_fotka` a `profilovy_vyrez` (popis v `EXPORT.md`). Výjimka je zapsaná v `ROADMAP.md` (oddíl „Výjimka: profilová fotka“).

## [1.2.64] – 2026-11-05

### Přidáno
- **Vlastní výřez profilové fotky**: v nabídce ⋯ profilu je *Upravit výřez profilové fotky* (když modelka profilovou fotku má). Úprava probíhá stejně jako u titulní (tažením posun, kolečkem nebo posuvníkem přiblížení) v rámu fotky v panelu Údaje, kde se po dobu úpravy ukáže profilová fotka. Výřez profilové a titulní fotky jsou na sobě nezávislé; nová profilová fotka svůj starý výřez zruší. Výchozí výřez profilové fotky ukazuje její horní část.

## [1.2.63] – 2026-11-05

### Přidáno
- **Profilová fotka oddělená od titulní**: v nabídce fotky (pravé tlačítko nebo ⋯ na dlaždici, i v prohlížeči) je nová položka *Nastavit jako profilovou fotku*. Profilová fotka se ukazuje v záhlaví profilu, titulní zůstává na kartě v galerii a v náhledech. Bez profilové fotky ukazuje záhlaví jako dosud titulní; v nabídce ⋯ profilu jde profilová fotka zrušit (*Zrušit profilovou fotku*). Schéma databáze se nemění (údaj je mezi nastaveními).

## [1.2.62] – 2026-11-05

### Změněno
- **Fotka v záhlaví profilu**: místo úzkého pruhu z portrétu (u širokého okna bylo vidět jen čelo) je vpravo ostrá titulní fotka s výřezem jako na kartě v galerii a za ní přes celé záhlaví tatáž fotka rozmazaná.

### Opraveno
- **Rozložení záhlaví v širokém okně**: drobečky jsou vždy samostatným řádkem nahoře, pod nimi jméno, akce a dole lišta alb (v širokém okně se jméno řadilo vedle drobečků).
- **Pásky Playmate, Cybergirl a čísel** jsou znovu plně růžové s bílým písmem.

## [1.2.61] – 2026-11-05

### Změněno
- **Nižší záhlaví profilu**: rozbalené záhlaví nahoře na stránce je o třetinu nižší. Drobečky jsou nahoře, jméno a akce pod fotkou a lišta alb dole. Po odrolování se dál svine do kompaktní podoby se sklem.

## [1.2.60] – 2026-11-05

### Změněno
- **Záhlaví profilu nahoře bez skla a dvakrát vyšší**: při otevření profilu je záhlaví dvakrát vyšší, fotka v banneru je bez ztmavení a rozostření a prvky nad ní nemají průsvitné podklady, jen stín pod textem. Po odrolování dolů se záhlaví plynule svine do dosavadní kompaktní podoby se sklem; po návratu nahoru se znovu rozbalí.

## [1.2.59] – 2026-11-05

### Změněno
- **Sjednocený vzhled záhlaví profilu**: všechny prvky nad fotkou v banneru (drobečky, pořadí, pásky čísel, akce) mají jednotný průsvitný vzhled s rozmazaným pozadím a jemným okrajem; banner je světlejší a ztmavený jen pod jménem vlevo a u lišty alb, takže fotka modelky víc vynikne. Tlačítka akcí jsou v samostatném řádku uprostřed; sytě růžová zůstala jen u Přidat fotky a zvoleného alba. Pásky čísel jsou průsvitné s růžovým písmem místo plných růžových pruhů.

### Opraveno
- **Tlačítko Centerfold v profilu nic nedělalo**: po přesunu akcí do záhlaví okna kliknutí neobsloužil nikdo; teď znovu otevře centerfold v prohlížeči.

## [1.2.58] – 2026-11-04

### Přidáno
- **Profil modelky se širokoúhlým bannerem**: záhlaví profilu má na pozadí titulní fotku modelky (s jejím výřezem) přes celou šířku, od drobečků po lištu alb; miniatura v pruhu odpadla. Panel se při rolování už nezmenšuje.

### Opraveno
- **Rozpadlé záhlaví profilu**: lišta alb vyjížděla přes řádek s pořadím a odznaky (zdědila lepivý posun o 32 px) a nebyla přes celou šířku; v užším okně se jméno modelky zúžilo do ztracena a pásky čísel se překrývaly s pořadím. Teď jsou identita, pásky a akce v jednom řádku, v užším okně se pásky a akce zalomí pod jméno, lišta alb je vždy pod nimi. Banner po úpravě výřezu titulní fotky drží správný výřez.

## [1.2.57] – 2026-11-04

### Změněno
- **Balíček `internal/kontrola`, rozdělení `kontrola.go` a optimalizace kontroly údajů i návrhů**: pravidla kontroly podezřelých údajů, statistické učení rozsahů postavy, trigramové a Jaro–Winklerovo porovnání podobných jmen a generování návrhů doplnění chybějících údajů (včetně zeměpisných zkratek, měr a alb) jsou vyčleněné do samostatného balíčku `internal/kontrola`. Původní `kontrola.go` je odlehčena na delegáta a rozdělená na `kontrola.go`, `kontrola_uceni.go` a `kontrola_jmena.go`. Trigramový slovník jmen používá bitově balené 64bitové klíče bez alokací na haldě, párování jmen prochází invertovaný index s rychlou délkou a znakovým bufferem, datum v názvech alb provádí rychlé předfiltrování čtyřčíslí před vyhodnocením regulárních výrazů a hledání fotografů a čísel alb sdružuje klíče v jediném průchodu.

## [1.2.56] – 2026-11-04

### Změněno
- **Balíček `internal/oblibenost`, rozdělení `oblibenost_vkus.go` a optimalizace oblíbenosti, témat a front**: výpočty oblíbenosti (Bradley–Terry, Choleského rozklad, série dní), regresní stromy modelu vkusu, skóre fotek a datové typy front fotek i galerie Nejlepší jsou vyčleněné do samostatného balíčku `internal/oblibenost` a `oblibenost_vkus.go` je rozdělený na přípravu údajů (`oblibenost_vkus.go`), učení (`oblibenost_vkus_uceni.go`) a skládání důvodu (`oblibenost_vkus_duvod.go`). V Bradley–Terry se Böhningova mez každého uzlu předpočítá jednou před iteracemi, Gramova matice hřebenové regrese se skládá jen v dolním trojúhelníku a doplní symetricky, stavba stromu používá pole na zásobníku a série dní kalendářní čísla místo mapy textů. Fotky pro témata už nealokují mapu tagů u každé ze statisíců fotek a vystačí si s bitovou maskou, pokrytí tématu k odemčení počítá v předem alokovaných polích místo map, čtení snímků historie pro síň slávy neformátuje datum v každém řádku, galerie Nejlepší ověřuje mezipaměť bez kopírování modelek a tisíců převodů čísel na text a řazení front fotek předpočítává zjednodušená jména modelek před řazením.

## [1.2.55] – 2026-11-03

### Změněno
- **Balíček `internal/sbirka`, rozdělení `app.go` a čistě paměťové statistiky a vývoj**: statistiky sbírky, vývoj v čase, katalog a správa tagů fotek i vyhledávání v článcích a textech jsou vyčleněné do samostatného balíčku `internal/sbirka` a původní soubor `app.go` je rozdělený podle oblastí (`modelky.go`, `fotky.go`, `kalendar.go`, `zalohy.go`, `kontrola_souboru.go`). `GetStatistiky` a `GetVyvojVCase` počítají přímo nad paměťovým snímkem sbírky bez dotazů do databáze a bez opakovaného klonování seznamu modelek, oprava snímku po uložení srdíčka nebo výřezu zachovává vypočtené texty hledání, kalendář a náhledy, `SetHodnoceni` si pamatuje přítomnost sloupce `hodnoceni_pul`, `nactiFotografie` nealokuje pole cílů pro každý řádek, `SetTagyFotek` maže ostatní tagy výlučné skupiny jedním příkazem a tvorba úryvku textu článku zpracovává znaky ASCII přímo bez alokací.

## [1.2.54] – 2026-11-03

### Změněno
- **Balíček `internal/uceni` a optimalizace modelů učení a otisků**: sdílené modely pro texty (`SlovnikHodnot`, Jaro–Winkler, Bayesovské skládání zdrojů), profil postavy (`RegreseObvodu`, `SousedePostavy`), FNV-64a otiskovač a správa databáze učení jsou vyčleněné do samostatného balíčku `internal/uceni`. Přenos databáze učení do paměti běží v jediné transakci s připraveným příkazem místo jednotlivých dotazů, odhad podle nejbližších sousedů řadí kandidáty přímo na zásobníku bez alokací na haldě a počítá váhu s odmocninou jen jednou, lineární regrese nevytváří mapu odlehlých řádků, otisk modelky nevolá `fmt.Sprint` a `GetStavUceni` zjišťuje počet porovnání dotazem `SELECT COUNT(*)` místo načtení celé tabulky do paměti.

## [1.2.53] – 2026-11-03

### Změněno
- **Balíček `internal/hledani` a zrychlené vyhledávání a příprava textů**: normalizace textu bez diakritiky, Levenshteinova vzdálenost, příprava vyhledávacích textů u modelek a vyhodnocení dotazu (včetně filtrů s dvojtečkou, porovnání a rozsahů) jsou vyčleněné do samostatného balíčku `internal/hledani` s vlastními jednotkovými testy. Levenshteinova vzdálenost počítá do polí na zásobníku bez alokací na haldě, příprava textů modelky skládá vyhledávací řetězec v jediném `strings.Builder` a předpočítává kategorie i výskyty pro okamžité vyhodnocení filtrů `kategorie:` a `vyskyt:`, a vyhodnocení dotazu ukončuje vnitřní smyčky hned po první shodě a parsuje čtyřciferný rok bez volání `strconv.Atoi`.

## [1.2.52] – 2026-11-03

### Změněno
- **Balíček `internal/nahledy` a rychlejší čtení náhledů**: místní mezipaměť náhledů a stahování na pozadí jsou vyčleněné do samostatného balíčku `internal/nahledy` s vlastními jednotkovými testy (bez globálního stavu stahování na pozadí). Čtení uloženého náhledu z disku nepouští druhý systémový dotaz `stat`, rozbor adresy `/nahled/<id>/<velikost>` a ověření velikosti probíhá bez alokací a bez regulárního výrazu, zápis do souboru nealokuje čtečku a výběr položek k předstažení skládá klíč přímo ze struktury místo spojování řetězců.

## [1.2.51] – 2026-11-03

### Přidáno
- **Panel průvodce jde přesunout**: v Hodnotit › Průvodce se panel s tagy přesouvá tažením myší za úchyt ⠿ vlevo v hlavičce (nebo za volné místo hlavičky) a program si polohu pamatuje i po zavření prohlížeče a dalším spuštění. Panel nevyjede z okna; dvojklik na úchyt ho vrátí na výchozí místo pod středem. Ovládání klávesnicí se nemění.

## [1.2.50] – 2026-11-03

### Přidáno
- **Galerie (Nejlepší), krok 1 – nová data**: backend umí nejlepší fotky sbírky filtrovat (od kolika srdíček, typ fotky, desetiletí, hledání), řadit (hodnota = srdíčka fotky × oblíbenost modelky, jen srdíčka fotky, nejnovější, náhodně) se střídáním modelek (každá další fotka téže modelky o čtvrt srdíčka níž) a posílat po stránkách zhuštěně. Se sbírkou 27 600 fotek se 4+ srdíčky: první stránka 0,11 MB místo dnešních 12,3 MB, další stránky ~7 ms. Stránka Galerie zatím vypadá jako dřív; nová mřížka bez oddílů přijde v další verzi.

## [1.2.48] – 2026-11-03

### Změněno
- **Nápověda a plán po zrychlení**: nápověda má nový oddíl Rychlost, náhledy a výkon (úvodní obrazovka a příprava po startu, náhledy na disku a jejich stahování na pozadí, limit a mazání mezipaměti, Přehled výkonu). ROADMAP a plán náhledů zapisují, co z bodu 1.6 (Náhledy na disku) už vyšlo v 1.2.28–1.2.32 a co zbývá (okno Náhledy s volbou limitu, záložní adresa obrázků).

## [1.2.47] – 2026-11-03

### Přidáno
- **Přehled výkonu** (nabídka ⋯ › Nápověda): jak dlouho trval start do zobrazení a všechna volání programu v tomto spuštění – počet, průměr, nejdelší a celkový čas každého volání a seznam pomalých volání (nad 100 ms) s časem od startu. „Kopírovat jako text“ dá přehled do schránky (např. k poslání), „Vynulovat“ začne měřit znovu. Slouží k ověření rychlosti na skutečném počítači; data jsou jen v paměti okna.

## [1.2.46] – 2026-11-03

### Změněno
- **Srdíčko bez nového načtení sbírky**: srdíčka u fotky nebo modelky opraví paměť sbírky přímo (počty hodnocených fotek a srdíček alba, srdíčka po albech u jeho modelek, srdíčka modelky), místo aby se celá sbírka načetla z databáze znovu. Se sbírkou 150 000 fotek: po každém srdíčku ~240 ms → pod 0,1 ms. Výsledek je stejný jako po novém načtení (hlídá test); když paměť před zápisem neodpovídala databázi, načte se znovu jako dřív.

## [1.2.45] – 2026-11-03

### Změněno
- **Rychlejší načtení sbírky do paměti**: počty fotek a srdíček po albech (dotaz přes všechny fotky) se počítají souběžně na více jádrech po rozsazích alb. Paměť sbírky se načítá při startu a po každém zápisu; se sbírkou 150 000 fotek 314 → 241 ms.

## [1.2.44] – 2026-11-03

### Změněno
- **Rychlejší výběr dvojic v Porovnat**: kandidáti dvojic (desítky tisíc) se řadí přes předpočítané klíče místo přesouvání celých záznamů. Pořadí je stejné jako dřív (hlídá test). Se sbírkou 3 000 modelek: výběr dalších dvojic 37 → 26 ms.

## [1.2.43] – 2026-11-03

### Změněno
- **Menší data pro Centerfoldy**: stěna centerfoldů dostává fotky zhuštěně jako fronty Hodnotit (údaje alba jednou za album, adresa obrázku jako šablona) a řazení skládá backend z alb místo řazení všech fotek v databázi. Se sbírkou 3 000 modelek: data 3,5 MB → 1,1 MB, otevření Centerfoldů 220–270 → ~200 ms. Fotky, pořadí i údaje jsou stejné (hlídá test).

## [1.2.42] – 2026-11-03

### Změněno
- **Rychle ♥ po stránkách**: fronta nehodnocených fotek se načítá po 400 položkách a prohlížeč si další stránky dotahuje sám, když se blíží konci načtené části. Náhodné pořadí a seskupení (spojený centerfold je jedna položka) teď skládá backend – přesně stejně jako dřív okno (ověřeno na celé frontě 79 886 položek v obou řazeních). Počty, „zbývá“ a štítky modelek jsou dál za celou frontu, štítek modelky načte jen její fotky. Se sbírkou 150 000 fotek: data při otevření 8,4 MB → 0,23 MB, další stránky ~4 ms. Ohodnocené fotky stránky vynechají, takže se nic nepřeskočí ani neopakuje (hlídá test). Počítadlo „zbývá“ v prohlížeči i v Průvodci počítá i fotky za načtenými stránkami.

## [1.2.41] – 2026-11-03

### Změněno
- **Průvodce po stránkách**: fronta Hodnotit › Průvodce se načítá po celých albech – prvních asi 600 fotek hned, další stránka se dotáhne sama, když se průvodce blíží konci načtené části, nebo když klikneš na album dál ve frontě. Počet fotek, „zbývá“ a seznam alb jsou dál za celou frontu. Se sbírkou 150 000 fotek: data při otevření 14,3 MB → 0,45 MB, další stránky z paměti backendu pod 1 ms. Stránky navazují podle alb, takže fotky prošlé mezitím průvodcem nic neposunou (hlídá test).

## [1.2.40] – 2026-11-03

### Změněno
- **Oblíbenost uložená mezi spuštěními**: výsledek modelu oblíbenosti (oblíbenost, pořadí, úrovně Top, odhady srdíček) se ukládá do databáze učení. Když se od minulého spuštění nic nezměnilo (modelky, porovnání, zájem, den), dostane seznam modelek při startu oblíbenost hned a celý model se spočítá na pozadí. Měřeno se sbírkou 3 000 modelek: první načtení modelek po startu ~100 → 13–40 ms. Po jakékoli změně se počítá jako dřív.

## [1.2.39] – 2026-11-03

### Změněno
- **Čísla a Kalendář načítají obrázky postupně**: náhledy v Kalendáři, na stránce čísla, ročníku a fotografa se načítají stejně jako v galerii – asi dvě obrazovky dopředu podle rolování a odrolované, ještě nenačtené obrázky se zruší, aby fotky na obrazovce nečekaly ve frontě. Dřív používaly vestavěné líné načítání, které ve WebKitGTK začíná pozdě a odrolované obrázky neruší.

## [1.2.38] – 2026-11-03

### Změněno
- **Témata po srdíčku bez přepočtu**: paměť témat sezón (fotky s tagy a albem, soutěžící a pokrytí témat) se po zápisu nezahazuje, když se data témat nezměnila – program si pamatuje otisk fotek, alb, tagů, údajů modelek a průvodce a po srdíčku u fotky nebo souboji paměť jen přenese. Měřeno se sbírkou 3 000 modelek po srdíčku u fotky: návrh sezóny ~480 → 130–220 ms, témata k odemčení 70–120 → ~1 ms. Po změně tagu, alba nebo údaje modelky se témata spočítají znovu jako dřív (hlídá test).

## [1.2.37] – 2026-11-03

### Změněno
- **Témata sezón na více jádrech**: návrh sezóny a témata k odemčení vyhodnocují každé téma souběžně na všech jádrech procesoru a fotky prošlé průvodcem čtou z databáze jednou místo u každého tématu. Měřeno se sbírkou 3 000 modelek na 4 jádrech: návrh sezóny 280–430 → 180–210 ms, témata k odemčení 210–240 → 60–85 ms (volba sezóny, Hodnotit › Průvodce, předpříprava po startu). Výsledky jsou stejné.

## [1.2.36] – 2026-11-03

### Změněno
- **Rychlejší Statistiky**: modelky nejčastějších fotografů (pro výběr v grafu fotografů) posílá backend rovnou jako čísla modelek ve Statistikách, stejným hledáním jako „fotograf:"…"“ v Modelkách. Dřív si okno stahovalo pro každého fotografa celý seznam modelek (~1,7 MB). Měřeno se sbírkou 3 000 modelek: otevření Statistik 460–500 ms → 115–125 ms, přenesená data ~7 MB → 32 kB.

## [1.2.35] – 2026-11-03

### Změněno
- **Rychlejší Údržba**: řádky zvoleného údaje (Po údajích) se stavějí po dávkách – prvních 40 hned, zbytek v dalších krocích, aniž by okno zamrzlo. Údaj, který chybí stovkám modelek, dřív stavěl všechna pole najednou. Měřeno se sbírkou 3 000 modelek: otevření Sbírky 1,05–1,23 s → 0,53–0,63 s, nejdelší zamrznutí okna 0,67–0,74 s → 0,29–0,36 s. Enter na posledním vykresleném řádku dokreslí zbytek a pokračuje jako dřív.

## [1.2.34] – 2026-11-03

### Změněno
- **Rychlejší Centerfoldy**: stěna centerfoldů se kreslí po dávkách jako galerie – prvních 60 plakátů hned, zbytek v dalších krocích, aniž by okno zamrzlo. Měřeno se sbírkou 3 000 modelek: otevření 1,26–1,45 s (z toho přes sekundu zablokované okno) → 0,22–0,27 s, další otevření 0,77–1,29 s → 0,36–0,38 s. Skok na desetiletí v liště a návrat Zpět na místo dole na stránce dokreslí stěnu celou. Vzhled se nemění.

## [1.2.33] – 2026-11-03

### Změněno
- **Rychlejší návrat do Sbírky**: když se od posledního zobrazení nic v databázi nezměnilo, Sbírka (Mapa čísel, Údržba, Sháním) se znovu nenačítá ani nesestavuje – jen se ukáže, jak byla (dřív se při každém otevření sestavovala celá, se sbírkou 3 000 modelek 650–770 ms). Po jakékoli změně dat nebo přepnutí „zobrazit skryté“ se sestaví znovu jako dřív. Platí to i pro přechod z Hodnocení a Síně slávy zpět do Sbírky.

## [1.2.32] – 2026-11-03

### Změněno
- **Náhledy bez připojení**: když vypadne internet, program to pozná při prvním neúspěšném stažení a dalších 30 s se o stahování nepokouší – chybějící náhled hned ukáže „Nenačteno“ místo čekání na vypršení spojení (dřív až 20 s na každý obrázek) a stahování na pozadí počká. Jednou za 2 s jeden požadavek vyzkouší, jestli se připojení vrátilo; po návratu se nenačtené fotky načtou znovu jako dřív. Náhledy uložené na disku jsou vidět i bez připojení. Spojení s Diskem má kratší mez (5 s na připojení místo 20 s).

## [1.2.31] – 2026-11-03

### Přidáno
- **Stahování náhledů na pozadí**: minutu po spuštění se v klidu stáhnou na disk titulní fotky všech modelek a pak plakáty centerfoldů a obálky čísel (u 3 000 modelek kolem 4 600 obrázků, 3–6 minut), takže karty a stěny se ukážou hned i napoprvé. Stahují se nejvýš 3 najednou; když okno samo načítá obrázky, pozadí počká, a když Google začne odmítat, udělá pauzu. Co už na disku je, se přeskočí – další starty dotáhnou jen nové. Průběh je vpravo ve stavové liště („⬇ Náhledy 1 240 / 4 600“, ✕ zastaví) a v nabídce ⋯ › Soubory a mezipaměť (průběh, Zastavit / Stáhnout náhledy celé sbírky). Zastavení si program pamatuje, dokud stahování v nabídce znovu nespustíš.

## [1.2.30] – 2026-11-03

### Změněno
- **Předpříprava po úvodu**: v klidu po spuštění (nic se nenačítá, 0,6 s bez kliknutí či klávesy, okno je vidět) si program po krocích připraví témata sezón, Sbírku, kalendář, texty k hledání a statistiky. První otevření je pak rychlejší: volba sezóny ~1,3 → 0,15 s, Sbírka o 0,3–0,55 s, Čísla, Kalendář a první hledání o 50–75 ms (měřeno se sbírkou 3 000 modelek). Kliknutí během kroku ho nepřeruší, další krok počká. Po změně dat se zneplatněné kroky zopakují až po 5 s klidu (po srdíčku jen témata a texty). Úvod se tím neprodlužuje a nic zastaralého se neukáže – připravuje se jen to, co backend už dřív hlídal proti změnám.

## [1.2.29] – 2026-11-03

### Přidáno
- **Úklid náhledů na disku**: minutu po spuštění se v klidu smažou náhledy fotek, které už ve sbírce nejsou, a když mezipaměť přeroste 1 GB, nejdéle nepoužité náhledy (titulní fotky a plakáty celé sbírky zaberou kolem 250 MB). „Vymazat mezipaměť obrázků“ v nabídce ⋯ smaže i náhledy na disku a změna šablony adresy obrázků v nastavení je zahodí (můžou být z jiného zdroje).

## [1.2.28] – 2026-11-03

### Přidáno
- **Náhledy na disku**: náhledy z Google Disku (karty modelek a dlaždice fotek w400, plakáty a obálky w600) se po prvním zobrazení uloží do `~/.cache/playboy-app/nahledy` (jen pro vlastníka, jako databáze) a příště se ukážou hned odtud – i bez připojení a i po delší pauze (mezipaměť okna si obrázky z Disku pamatovala jen 24 hodin, pak je znovu ověřovala na Googlu). Nestažené náhledy se stahují až 16 najednou (dřív 6), takže i první zobrazení je rychlejší. Velké fotky v prohlížeči jdou dál přímo z Disku a neukládají se; kontrola souborů na Disku chodí vždy přímo na Disk. Limit velikosti a úklid přijdou v další verzi.

## [1.2.27] – 2026-11-03

### Změněno
- **Lehčí start**: automatická kontrola sezóny po spuštění se nejdřív zeptá jen na stav sezóny; návrhy témat a témata k odemčení (asi 0,7 s práce na pozadí) počítá, jen když se okno volby sezóny opravdu ukáže. Kliknutí hned po startu tak už nečeká na zbytečný výpočet.
- **Rychlejší Hodnocení**: počet nehodnocených fotek (hlavička, pilulka) se bere z paměti sbírky místo dotazu do databáze (35–110 ms → pod 1 ms při každém otevření).
- **Rychlejší Síň slávy**: nenačítá dvojice k porovnání; načtou se, až se přepne do Hodnocení.

## [1.2.26] – 2026-11-03

### Opraveno
- **Šedé dlaždice v kruhu úvodu**: do výběru profilovek pro příští spuštění se dostaly i rozdělané modelky, jejichž titulní fotka se nenačte. Teď se uloží jen fotky, které se opravdu načetly (z 24 náhodných kandidátek nejvýš 14; když se jich načte méně než 4, zůstane minulý výběr). Fotku, která se při startu nenačte, nahradí v kruhu jiná ze seznamu; když se nenačte žádná, ukáže se místo kruhu ikona a výběr se při dalším běhu sestaví znovu.

## [1.2.25] – 2026-11-03

### Přidáno
- **Úvodní obrazovka při spuštění**: okno se otevře hned s úvodem (název, verze, pruh postupu a co se právě připravuje: sbírka, galerie, náhledy, Hodnocení) a program se ukáže až sestavený – galerie i s náhledy první obrazovky, pořadí oblíbenosti a stav sezóny spočítané dopředu (první otevření Hodnocení je okamžité). Místo loga se točí kruh náhodných profilovek modelek, při každém spuštění jiných (výběr se ukládá pro příští start a obrázky se předem načtou); při prvním spuštění je vidět ikona. Se zámkem heslem se profilovky neukazují (úvod je vidět před heslem). Při omezení pohybu v systému je kruh statický. Úvod zmizí nejpozději po 15 s, i kdyby se příprava zasekla; okno s novinkami po aktualizaci přijde až po něm.

## [1.2.24] – 2026-11-03

### Změněno
- **Rychlejší přepočet po porovnání**: údaje modelek pro model vkusu (vlasy, národnost, fotografové, skóre fotek…) se porovnáním nemění, takže se drží v paměti a znovu se připraví jen po změně modelek. Měřeno s 3 000 modelkami: přepočet pořadí po porovnání 60 → 45 ms. Výsledek je stejný (hlídá test).
- **Mozaika v profilu**: po načtení obrázku se řady přepočítají jen v albech, kde se obrázek načetl, ne ve všech albech profilu; stejně tak rozbalení či sbalení alba.

## [1.2.23] – 2026-11-03

### Změněno
- **Rychlejší Hodnotit › Průvodce a Rychle ♥**: fronty fotek posílají údaje alba (modelka, název, popis, fotograf, další modelky) jen jednou za album a adresu obrázku jako šablonu, ne u každé fotky zvlášť; řazení fronty se skládá z alb místo řazení všech fotek v databázi. Měřeno se 150 000 fotkami: fronta průvodce 67 → 14 MB a 1,4 → 0,5 s, nehodnocené fotky 36 → 8 MB a 0,75 → 0,3 s. Pořadí a obsah front se nemění (hlídá test).

## [1.2.22] – 2026-11-03

### Změněno
- **Rychlejší start**: denní záloha a první načtení sbírky (modelky, alba) běží na pozadí, zatímco se okno teprve načítá – okno na ně nečeká. Názvy speciálů a seznam modelek se načítají souběžně a denní ověření souborů na Disku začne až 5 s po spuštění. Měřeno se sbírkou 3 000 modelek / 150 000 fotek: příprava před otevřením okna při prvním spuštění dne 420 → 205 ms, snímek sbírky (310 ms) se počítá souběžně s načítáním okna. Obnovení zálohy i zavření programu počkají, až záloha na pozadí doběhne.

## [1.2.21] – 2026-11-03

### Změněno
- **Chytřejší mezipaměť**: srdíčko, souboj v Porovnat, tagy z průvodce a ověření souborů už nezahazují seznam čísel, speciálů, kalendáře a fotografů – po každém porovnání se tak znovu nenačítají speciály. Stejné souběžné dotazy (stav sezóny, návrh sezóny, témata k odemčení, speciály, počet fotek k průvodci) se sloučí do jednoho volání.

### Opraveno
- Uložení tagů fotky, krok průvodce, jeho vrácení, volba období sezóny a souboj v tématu se braly jako čtení a nezneplatnily mezipaměť – pohledy pak mohly ukázat stav před změnou.

## [1.2.20] – 2026-11-03

### Změněno
- **Rychlejší Hodnocení a Síň slávy**: při otevření se už nenačítá a nekreslí celá Sbírka (přehled sbírky, kalendář, stavy čísel, návrhy doplnění a Údržba) – stačí modelky. Sbírka se načte, až když se na ni přepne. Měřeno s 3 000 modelkami: Hodnocení 615 → 275 ms, Síň slávy 370 → 60 ms.

## [1.2.19] – 2026-11-03

### Změněno
- **Galerie modelek se vykresluje po dávkách**: prvních 200 karet hned, zbytek na pozadí. S tisíci modelkami se galerie ukáže zhruba dvakrát až čtyřikrát rychleji – při startu, po změně řazení, hledání i při návratu z jiné sekce (měřeno: návrat do Modelek 450–630 → 100–190 ms, změna řazení 470 → 130 ms). Lišta písmen ukazuje všechny části hned; skok na ještě nevykreslenou část a návrat Zpět na místo dole na stránce galerii nejdřív dokreslí.

## [1.2.18] – 2026-11-03

### Změněno
- **Plynulejší rolování**: plovoucí pás stránky (Hodnocení, Síň slávy, Sbírka) se při rolování už nehledá v celé stránce v každém snímku a výšku zapisuje jen při změně – v galerii s tisíci kartami ušetří většinu práce skriptu při rolování.
- Pořadí: „Zobrazit dalších 100“ jen připojí řádky (dřív se celé pořadí kreslilo znovu, s 1 000+ modelkami 150 ms → 20 ms).
- Stránka čísla: označování přečtených stran při rolování nejvýš jednou za snímek.

### Opraveno
- Formátování zdrojového kódu po 1.2.17 (jen vzhled kódu, chování beze změny).

## [1.2.17] – 2026-11-02

### Změněno
- **Rychlejší backend** (měřeno na sbírce 3 000 modelek a 150 000 fotek):
  - výběr dvojic v Porovnat 247 → 55 ms (soupeřky pro ověření srdíček se třídí jednou, ne pro každou modelku);
  - volba sezóny a Odemknout téma: výsledky témat se pamatují, dokud se ve sbírce nic nezmění (napodruhé 1,3 s → 12 ms a 0,2 ms), a napoprvé se počítají rychleji – údaje modelky jednou za modelku, podmínky na album jednou za album, tagy jako bitová maska;
  - počet fotek bez tagů 71 → 7 ms, alba fotografa 1,4 s → 0,24 s;
  - řazení podle jména bez diakritiky bez zbytečných kopií textu;
  - SQLite má větší vyrovnávací paměť (32 MB) a dočasné řazení v paměti.

### Opraveno
- Změna výřezu titulní fotky už nemění snímek sbírky, který zrovna čte jiné volání (souběh).

## [1.2.16] – 2026-11-02

### Změněno
- **Rychlejší sezóny a témata**: fotky s tagy a údaji alb pro témata se načtou jednou a pamatují se, dokud se ve sbírce nic nezmění – Síň slávy, volba sezóny, Porovnat v tématu i průvodce je dřív načítaly celé znovu při každém dotazu.
- **Okna volby a vyhlášení sezóny drží fokus** (Tab neodejde do aplikace pod oknem); prvky s fokusem mají viditelný rámeček; výsledek losu oznámí i čtečka obrazovky.
- Vyhlášení sezóny začíná fokusem na první kandidátce na Miláčka – Enter tak neuzavře sezónu dřív, než si volby všimneš.

## [1.2.15] – 2026-11-02

### Přidáno
- **Stav tématu sezóny je vidět**: když zvolené téma nemá dost soutěžících a sezóna běží jako Klasická, Síň slávy › Sezóna i stavová lišta ukážou „⚠ Téma „Na podpatcích“ teď nemá dost soutěžících (6 z 8)“ s odkazem **🔓 Odemknout v Průvodci**; sezóna bez tématu nabídne ✦ Zvolit téma.
- Pohled Sezóna má nad trůnem řádek sezóny: téma s ikonou (nebo Klasická), období, kolik zbývá a počet soutěžících.
- Pravidla v Síni slávy vysvětlují tematické sezóny (6 fotek tématu, 8 modelek, souboje v režimu tématu).
- Volba sezóny uprostřed sezóny upozorní, že souboje z předchozích dní se do tematické sezóny nezapočítají.
- Porovnat v režimu Bez tématu ukáže ve stavové liště, že se souboje do tematické sezóny nepočítají (T přepne).

## [1.2.14] – 2026-11-02

### Změněno
- **Názvy sezón ve větě**: tematická sezóna je v uvozovkách („Sezóna „Na podpatcích“ skončila“, v kronice „Favoritka sezóny „Na podpatcích“ (2.–15. listopadu 2026)“), takže nevznikají zdvojení. Témata s „sezónou“ v názvu se přejmenovala: Blondýnky, Mokrá kůže, Hladké linie, Brunetky, Úsměvy; dále Zlatá hodina a Společné focení (klíče témat se nemění).
- Hodnotit: pohled Jen srdíčka se jmenuje **Rychle ♥** (aby se nepletl s režimem J „jen srdíčka“ v průvodci).
- Porovnat: režim Klasické se jmenuje **Bez tématu** (Klasická zůstává název sezóny bez tématu).
- Volba sezóny: témata, která nejdou hrát, mají u důvodu „· odemkneš v Průvodci“.
- Nápověda a přehled zkratek odpovídají ovládání: výběr v Porovnat (Enter / ♥ Tahle, ← → listují pásem), tři pohledy Hodnotit, štítek s ikonou tématu na švu.

### Opraveno
- Skloňování: „1 soutěžící“, „1 výhra, 2 remízy…“, věta o modelkách bez 3 soubojů; vyhlášení bez Favoritky už neříká „Favoritkou sezóny je modelka“.

## [1.2.13] – 2026-11-02

### Opraveno
- Volba sezóny: zavření okna během losu už nic neshodí; ručně vybrané téma během animace losu se nepřepíše vylosovaným; „—“ v Jiném tématu nevybere Klasickou; dvojklik na Začít sezónu nezapíše dvakrát a chyba se oznámí.
- Vyhlášení sezóny: dvojklik na Uzavřít sezónu neuzavře dvakrát; při spuštění a zároveň kliku na Vyhlásit se neotevřou dvě okna.
- Volba i vyhlášení se zavírají jen tlačítkem Později nebo Esc – klik vedle okna je už omylem nezavře.
- Síň slávy: Enter na „⚔ Vyzvat o trůn“ už neotevře zároveň profil modelky.
- Průvodce: chyba načtení fronty se ukáže jako chyba, ne jako „Všechny fotky prošly průvodcem“.
- Profil: když se nepodaří načíst tituly sezón, odznaky se přesto ukážou.

## [1.2.12] – 2026-11-02

### Opraveno
- Průvodce: Jen srdíčka (J) → Vrátit → zpět na celý průvodce už nesmaže fotce tagy (stav se postaví ze skutečných tagů fotky).
- Průvodce: dvojí rychlé Vrátit vrátí dvě fotky po sobě, ne jednu fotku dvakrát (fronta se nezdvojí); Vrátit během ukládání počká na zápis.
- Průvodce: po zavření se fronta načte až po doběhnutí zápisů (i u poslední fotky a rozpracovaných kroků), takže se neukáže fotka, která se právě ukládá; nepovedený zápis rozpracovaných tagů se oznámí.
- Průvodce: když se nepodaří načíst kroky, oznámí to a prohlížeč neotevře (dřív by 1–5 hodnotilo jako běžný prohlížeč).
- Porovnat: po zvolení nebo uzavření sezóny přepne téma hned (ne až po přepočtu přehledu); přepnutí T během načítání nesmíchá dvojice obou režimů.

## [1.2.11] – 2026-11-02

### Opraveno
- **Uzavření sezóny jen jednou**: dvojklik na Vyhlásit (nebo dvě okna) už nezapíše Favoritku a Miláčka do kroniky podruhé (ani druhý titul do odznaku Favoritka).
- **Téma sezóny podle toho, jak sezóna běžela**: skončená sezóna je tematická, jen když se v tématu opravdu porovnávalo – jinak se uzavře jako Klasická. Probíhající sezóna, ve které už jsou souboje v tématu, zůstane tematická, i když tématu mezitím ubude soutěžících; v Porovnat jde dohrát. Dřív se platnost brala podle dnešních fotek, takže body mohly zmizet a sezóna se nemusela nikdy uzavřít.
- **Období sezón bez mezer** i po přechodu z měsíčních sezón (témata více budoucích měsíců z 1.1.2); první období začne 1. dnem měsíce, zkrácený měsíc má správný název a titul v kronice svůj název sezóny.
- Klíče témat se ukládají jednotně (souboje, sezóny a návrhy se spolehlivě párují); sezóna s tématem, které už nejde načíst, se jmenuje podle období, ne „Klasická“.
- Průvodce: smazaná fotka už neshodí uložení ani vrácení (spojený plakát se uloží bez ní); Vrátit obnoví tagy přesně.
- Volba tématu a délky sezóny se kontroluje i zapisuje najednou (souběžně založené období ji nerozbije).

## [1.2.10] – 2026-11-02

### Přidáno
- **Skoro hratelná témata ve volbě sezóny**: pod nabídkou až tři témata, která průvodce brzy odemkne („🔓 👠 Na podpatcích · chybí 1 modelka · 2 fotky“). Klik volbu sezóny odloží a spustí průvodce rovnou na fotkách, které chybí; po odemčení téma zvolíš tlačítkem ✦ Zvolit téma sezóny v Síni slávy.

## [1.2.9] – 2026-11-02

### Přidáno
- **Odemknout téma** (Hodnotit › Průvodce): pod frontou čipy témat sezón, kterým chybí pár soutěžících – „🔓 👠 Na podpatcích · chybí 1“ (v bublině kdo je nejblíž a kolik fotek chybí). Klik spustí průvodce jen na neprošlých fotkách těchto modelek, které téma můžou dostat (nejbližší napřed).
  - Pásek ukazuje postup tématu („🔓 Na podpatcích · 7/8 · Anna 5/6“), přijde oznámení „Anna teď soutěží…“ a „🔓 Odemčeno téma“; Vrátit postup vrátí.
  - Počítají se jen témata s podmínkou na tagy (éry a údaje modelky tagováním odemknout nejde).

## [1.2.8] – 2026-11-02

### Změněno
- **Průvodce přeskočí srdíčka u fotky, která je už má** (ohodnocená dřív nebo v Jen srdíčka): po posledním kroku tagů se fotka uloží jako prošlá a srdíčka zůstanou; v pásku je vedle názvu kroku ukáže ♥ a tečky postupu krok srdíček nemají. V režimu Jen srdíčka se fotky se srdíčky přeskakují.

## [1.2.7] – 2026-11-02

### Přidáno
- **Jen srdíčka v průvodci** (klávesa **J** nebo tlačítko v pásku): 1–5 uloží jen srdíčka a ukáže další fotku, tagy počkají – fotka se příště nabídne v průvodci znovu. J přepne zpět na celý průvodce; volba se pamatuje.
- Pásek průvodce bez pohybu myši a kláves po chvíli zeslábne, aby nerušil fotku; nad ním a při stisku se hned vrátí.

### Změněno
- **Průvodce je výchozí pohled Hodnotit** (dřívější volba Fotky / Tagy se nepřebírá; Jen srdíčka a Modelky zůstávají v přepínači).

## [1.2.6] – 2026-11-02

### Přidáno
- **Průvodce hodnocením fotky** (Hodnocení › Hodnotit › **Průvodce**): skleněný pásek pod středem fotky provede tagy krok po kroku – Záběr, Odhalení, Prostředí, Tělo a nohy, Oblečení, Póza a výraz, Styl fotky – a nakonec srdíčka.
  - Číslice **1–9** vybírá (i na numerické klávesnici a správně i na české klávesnici) – u záběru, odhalení a prostředí rovnou pokračuje, jinde přepíná a **Enter** potvrdí; **0** = žádná u volitelných kroků; **Backspace / ←** zpět (na prvním kroku vrátí minulou fotku); **Shift+Enter** tagy jako minulá fotka a rovnou srdíčka; srdíčka **1–5** fotku uloží a ukáží další.
  - Prostředí, styl a oblečení se předvyplní podle minulé fotky alba (obrysem, převezme je Enter); u portrétu se tělo přeskočí, nehodící se možnosti jsou ztlumené (čísla se nemění); tečky ukazují postup.
  - **S** přeskočí – potvrzené kroky se uloží a fotka se nabídne znovu; **H** pásek skryje a ukáže; zavření prohlížeče uloží rozpracované kroky. Ve stavové liště „Hotovo 3 · zbývá 120“ a „↶ Vrátit“.

### Změněno
- Pohled **Tagy** nahradil Průvodce (dosavadní panel tagů s klávesami Z/O/M… v prohlížeči skončil); pohled Fotky se jmenuje **Jen srdíčka**. Tagy ve výběru fotek (klávesa T) zůstávají.

## [1.2.5] – 2026-11-02

### Přidáno
- **Základ průvodce hodnocením fotky** (v rozhraní přijde v další verzi): kroky Záběr, Odhalení, Prostředí, Tělo a nohy, Oblečení, Póza a výraz, Styl fotky a nakonec srdíčka – každý nejvýš 9 možností, volitelné kroky s „0 = žádná“, podmínky (Tělo a nohy se u portrétu přeskočí, nehodící se možnosti se ztlumí) a předvyplnění podle minulé fotky alba.
  - Program si pamatuje, které fotky prošly průvodcem; přeskočená fotka si nechá tagy z potvrzených kroků a nabídne se znovu. Zápis jde vrátit.

### Změněno
- **Úprava databáze č. 15 a formát exportu verze 12** (`pruvodce` u fotky). Soubory verze 11 a starší se načtou beze změny; starší program soubor verze 12 odmítne a novější databázi otevře jen pro čtení. Výjimečně v řadě 1.2 (ROADMAP, Pravidlo verzování).

## [1.2.4] – 2026-11-02

### Změněno
- **Pestřejší návrhy témat ve volbě sezóny**: tři návrhy jsou vždy éra nebo kalendář · styl nebo místo · původ, půvab nebo kombinace; zhruba ve třetině sezón je na třetím místě **vzácné** téma (málo soutěžících – objev méně známých modelek). Téma, které ještě neběželo, má větší šanci a štítek **poprvé**; skupina minulé sezóny menší. Téma, ve kterém by soutěžilo přes 70 % pořadí, se nenavrhuje (je to prakticky Klasická).

## [1.2.3] – 2026-11-02

### Přidáno
- **Ikona a popis afinity u každého tématu sezóny**: karta ve volbě sezóny ukáže ikonu, název a jednu větu („📼 Zlatá devadesátá – Supermodelková éra na vrcholu formy.“), v nabídce „Jiné téma“ je ikona u názvu a popis v bublině; v Porovnat má ikonu tématu štítek na švu i přepínač režimu.
- **Témata pro tagy fotek**: **Černobílá múza**, **Film noir**, **Noir**, **Andělské světlo**, **Sépiová nostalgie**, **Zlatá hodinka**, **Po setmění**, **Tváří v tvář**, **Úsměvy sezóny**, **Umění detailu**, **Bunny klasika**, **Denim Americana**, **Kůže a lesk**, **Role a kostýmy**, **Dámy v šatech**, **V jeho košili**, **Ve dvou**, **Nekonečné nohy**, **Budoár**, **U bazénu**, **Návrat k přírodě**, **Pěna a pára**, **Studiové světlo**, **Benzín a chrom** a **Noc ve městě**.
- Téma mimo slovník dostane ikonu a popis složený z podmínek.

## [1.2.2] – 2026-11-02

### Přidáno
- **Témata sezón podle údajů modelky**: původ – **Krásky od nás**, **Středoevropský půvab**, **Severská krása**, **Středomořský temperament**, **Latinský žár**, **Britský šarm**, **Od protinožců**, **Americký sen** –, kategorie – **Playmates měsíce**, **Královny ročníku** (Playmate roku), **Digitální múzy** (Cyber Girls), **Tváře obálek** –, **Azurové pohledy**, **Smaragdové oči**, **Kaštanová sezóna**, **Čisté plátno** (bez tetování) a kombinace **Domácí scéna**, **Severská divočina**, **Slunce a blond**.
  - Národnost se pro témata sjednotí podle tabulky zemí („Česká“, „Česko“ i „Czech“ je totéž); modelky s neznámou národností do témat původu nepatří.

## [1.2.1] – 2026-11-02

### Přidáno
- **Témata sezón podle vydání alba** (bez tagování): éry podle roku vydání – **Swingující šedesátá**, **Návrat do sedmdesátek**, **Lesk osmdesátek**, **Zlatá devadesátá**, **Nové milénium**, **Desátá léta**, **Současná éra** –, **Letní čísla** (červen–srpen), **Vánoční čísla**, **Česká edice**, **Středová dvoustrana** (centerfoldy) a kombinace **Léto devadesátých** a **Osmdesátky v nylonu**. Online alba se řadí podle data nafocení; alba bez vydání do ér nepatří.
  - V tématu se počítají a v Porovnat ukazují jen fotky z alb, která podmínku splňují.

## [1.2.0] – 2026-11-02

### Přidáno
- **Další tagy fotek** (tematické sezóny, krok 2 rozšíření): skupiny **Barevnost** (černobílá, tónovaná / sépie), **Světlo** (světlé high-key, tmavé low-key / noir, zlatá hodina, noc / umělé světlo) a **Výraz** (pohled do kamery, úsměv); do prostředí **bazén** a **auto / motorka**, do oblečení **zaječí uši** a **džíny / denim**. Barevnost a světlo se tagují jen u výrazných fotek.
  - Rychlé tagování: **B** barevnost a **L** světlo cyklují jako Z/O/M, **K** pohled do kamery a **U** úsměv přepínají; barevnost a světlo se předvyplní podle minulé fotky alba.
  - Panel tagů v prohlížeči má výšku podle obsahu a prohlížeč nad ním se přizpůsobí.

### Změněno
- Názvy tagů: „Jiný interiér“, „Pláž / moře“ (bazén má vlastní tag), skupina „Póza a situace“; kódy se nemění.
- **Formát exportu verze 11** (nové tagy; starší program by je při obnově zálohy tiše zahodil, takže soubor nové verze odmítne). Soubory verze 10 a starší se načtou beze změny.

## [1.1.6] – 2026-11-02

### Přidáno
- **Tituly sezón v profilu modelky**: vedle odznaků ♛ Favoritka a ♥ Miláček s názvem sezóny („♛ Na podpatcích“, „♥ říjen 2026“), nejvýš tři nejnovější, celý seznam v bublině; klik otevře kroniku Síně slávy.

## [1.1.5] – 2026-11-02

### Opraveno
- **Kronika Síně slávy pojmenuje sezónu správně**: zápis Favoritky a Miláčka nese název sezóny – „Marta je Favoritka sezóny Na podpatcích (2.–15. listopadu 2026)“, u Klasické jen období. Dřív se psal jen měsíc, takže víc sezón v jednom měsíci splývalo.

### Změněno
- Pravidlo verzování: tvar `x.xx.xxx` – PATCH může mít až tři číslice (0–999), aby šlo vydávat po menších krocích (ROADMAP, oddíl „Pravidlo verzování“).

## [1.1.4] – 2026-11-02

### Přidáno
- **Volba sezóny na jejím začátku** (tematické sezóny, krok 4): okno se třemi navrženými tématy s ukázkami fotek tématu, Klasickou, 🎲 losem a „Jiným tématem“; témata, která nejdou hrát, ukáže zašedlá s důvodem. Návrhy se neopakují z posledních tří sezón.
  - **Odhad délky**: potřeba soubojů podle počtu soutěžících dělená tvým tempem za posledních 30 dní, zaokrouhlená na nabízenou délku (7–30 dní); málo fotek tématu na modelku délku zkrátí. Doporučená délka je předvybraná se štítkem a výpočtem pod ní.
  - Otevře se po vyhlášení minulé sezóny nebo při spuštění; „Později“ ji odloží, zvolit jde i tlačítkem **✦ Zvolit téma sezóny** v Síni slávy nebo ze stavové lišty.
- **Tematický režim Porovnat**: v tematické sezóně vpravo v liště „✦ téma · Klasické“ (klávesa **T**). V tématu jen soutěžící, pásy jen s fotkami tématu, štítek tématu na švu a souboje se počítají do sezóny; výzva o trůn je vždy v tématu.

## [1.1.3] – 2026-11-02

### Změněno
- **Sezóny už nejsou pevné měsíce** (tematické sezóny): sezóna je období o délce 7, 10, 14, 21, 28 nebo 30 dní (výchozí 14) a sezóny jdou za sebou bez mezer. Probíhající listopadová sezóna doběhne do konce měsíce, starší sezóny zůstávají měsíční.
  - Sezóna se jmenuje podle tématu („Sezóna Na podpatcích“), jinak podle období („2.–15. listopadu 2026“) – v Síni slávy, Minulých sezónách, vyhlášení i stavové liště.
  - Uzavřená sezóna si pamatuje téma, ve kterém opravdu běžela (při málo soutěžících Klasická).
  - Volba tématu a délky v rozhraní přijde v dalším kroku.
- Databáze učení dostala úpravu pro období sezón (témata měsíců z 1.1.2 se převedou na období celého měsíce).

## [1.1.2] – 2026-11-02

### Přidáno
- **Témata sezón v programu** (tematické sezóny, krok 3; v rozhraní zatím nejsou): téma je sada podmínek na tagy fotek a údaje modelky. Název dává slovník – „Přírodní krása“, „Na podpatcích“, „Pod širým nebem“, „Ohnivé zrzky“…; kombinace mimo slovník se pojmenuje z frází podmínek („Podpatky · přírodní prsa“).
  - Soutěží modelky s aspoň 6 fotkami tématu; téma platí od 8 soutěžících, jinak sezóna běží jako Klasická.
  - Body se počítají jen ze soubojů v tématu, zájem jen u soutěžících; pásy v Porovnat ukážou jen fotky tématu.
- Databáze učení dostala úpravu pro témata sezón (stará data zůstávají jako Klasické sezóny).

## [1.1.1] – 2026-11-02

### Přidáno
- **Rychlé tagování – Hodnocení › Hodnotit › Tagy** (tematické sezóny, krok 2): fronta fotek bez tagů po albech; Enter nebo „Začít tagovat“ otevře prohlížeč s panelem skupin pod fotkou.
  - **Z** záběr, **O** odhalení, **M** místo – každý stisk další hodnota (se Shiftem zpět); **P** prsa, **V** vagina, **H** podpatky přepínají, ostatní tagy klikem.
  - Prostředí, odhalení a záběr se předvyplní podle minulé fotky téhož alba.
  - **Enter** uloží a ukáže další, **1–5** uloží i se srdíčky, **.** tagy jako minulá fotka, **⇧Enter** stejné tagy celému zbytku alba, **⌫** vrátí.
  - Ve stavové liště postup „Otagováno 3 · zbývá 120“, potvrzení a Vrátit.

## [1.1.0] – 2026-11-02

### Přidáno
- **Tagy fotek** – základ tematických sezón (krok 1). Pevný seznam 35 tagů v šesti skupinách: **Záběr** (portrét, poprsí, celá postava, detail), **Odhalení** (oblečená, spodní prádlo / plavky, nahoře bez, akt, explicitní akt), **Partie v záběru** (prsa, zadeček, vagina, nohy, chodidla), **Prostředí** (studio, interiér, ložnice, koupelna, příroda, pláž / voda, město), **Oblečení a doplňky** (podpatky, punčochy, podvazky, bikiny, šaty, košile, kostým, latex / kůže) a **Póza** (stojí, sedí, leží, zezadu, mokrá, víc modelek). Záběr, Odhalení a Prostředí mají jen jednu hodnotu. Typ prsou, ochlupení a podobně se berou z údajů modelky.
- Ve **výběru fotek** tlačítko se štítkem a klávesa **T** otevřou panel tagů: pilulka svítí, když tag mají všechny vybrané fotky, čárkovaně, když jen některé; klik tag přidá všem, u plné ho odebere.

### Změněno
- **Záloha (YAML) ve verzi 10** zapisuje i tagy fotek; starší zálohy se načtou jako dřív. Databáze dostane novou tabulku – program si před úpravou sám udělá zálohu.

## [1.0.17] – 2026-11-02

### Přidáno
- **Výběr modelky v Pořadí** (přepracování Pořadí, krok 3): šipky ↑↓ nebo najetí myší vyberou modelku a stavová lišta ukáže, co v řádku není – „11. Anna · bez srdíček · síla 3,92 ± 0,42 · 5 porovnání · čeká na Top 10 (5/8)“.
  - Písmena skočí na jméno, **Enter** otevře profil, **R** spustí souboje vybrané čekající nebo obhajující modelky.
  - Vpravo ve stavové liště **„⏳ Další čekající ↓“** a **„≠ Další nesedí ↓“** projdou takové modelky jednu po druhé; klávesy jsou klikatelné.

## [1.0.16] – 2026-11-02

### Změněno
- **Hodnocení má ve všech pohledech jen jednu lištu** (bez velké hlavičky s kruhem „dnes“ a okénky Top 10 a Sezóna – jsou ve stavové liště a v Síni slávy).
- **Pořadí** (přepracování Pořadí, krok 2):
  - Vpravo v liště **skoky na úroveň Top 10 · 20 · 50 · 100 · Mimo**; svítí úroveň, ve které je seznam odrolovaný. Oddělovače úrovní zůstávají při rolování přilepené nahoře.
  - **Řádek na jednu linku** (na obrazovku se vejde asi o polovinu víc modelek): místo, jméno se srdíčky, skóre fotek, zarovnaný trend a pruh síly, „jen 5×“ jen při málo porovnáních.
  - Vpravo v řádku štítek **„⏳ čeká na Top 10 (5/8)“ s ⚔ Rozhodnout**, u nesouladu **„≠ 4½ → 4 ♥“ s Dát a Nechat**. Pohledy Čekají a Nesedí zmizely – vše je v řádcích; odkaz na nesoulad ve stavové liště skočí na řádek.
  - V užším okně má přednost jméno.

## [1.0.15] – 2026-11-02

### Opraveno
- **Hodnocení › Pořadí:**
  - „Nechat“ v Nesedí funguje i po změně srdíček jinde; změna srdíček kdekoli hned odebere zastaralý nesoulad, obnoví počty a pořadí se po chvíli přepočítá.
  - „⚔ Ověřit porovnáním“ jen u modelky, která nečeká na úroveň ani ji neobhajuje (jinak spustilo souboje o úroveň).
  - Stavová lišta se obnoví i po „Dát jí“ a „Nechat“; počet čekajících sedí se seznamem Čekají a s „⚔ Rozhodnout N“.
  - „Dát jí“ ukáže nová srdíčka všude (i v Hodnotit › Modelky).
  - Při chybě načtení Pořadí vysvětlí, co se stalo, místo prázdné stránky.

### Změněno
- Pořadí se skládá jen tehdy, když je otevřené, a po stovkách („Zobrazit dalších 100“); řádky mimo obrazovku se nevykreslují – u velké sbírky výrazně rychlejší, i v Porovnat. Náhled v řádku má správný výřez tváře.

## [1.0.14] – 2026-11-02

### Změněno
- **Hodnocení › Hodnotit** (dřív Fotky) má dva pohledy, přepínač **Fotky · Modelky** s počty vpravo v hlavičce.
  - **Modelky**: karty modelek bez srdíček (napřed s nejvyšším odhadem vkusu); 1–5 na zaměřené kartě dá srdíčka (stejná znovu přidá půlku), fokus pak přejde na další. Ve stavové liště postup, „✓ 4½ ♥ Anna“ a pak „↶ Vrátit“ (Backspace).
- **Údržba už srdíčka modelek neřeší** (zmizela z filtrů, pokroku Sbírky i Po údajích); ve stavové liště Údržby je odkaz „♥ 5 modelek bez srdíček · Hodnotit →“.

## [1.0.13] – 2026-11-01

### Změněno
- **Hodnocení › Fotky** (přepracování Fotek, krok 2):
  - Hlavička je jen lišta jako v Porovnat: **♥ Hodnotit ↵**, **▶ Promítat**, panel a Náhodně / Po modelkách.
  - Na stránce velké **„♥ Začít hodnotit ↵“** přes pruh náhledů; **Enter** začne hodnotit, **mezerník** promítat. Karta Dál na řadě zmizela.
  - Ve stavové liště stránky počet a klikatelné klávesy ↵ Hodnotit · Mezerník Promítat.

### Přidáno
- **Živá stavová lišta v prohlížeči nehodnocených fotek:** zůstává vidět pod prohlížečem – dílky a „Ohodnoceno 3 · zbývá 53“, po hodnocení na chvíli „✓ ♥♥♥♥ Dana“ a pak „↶ Vrátit“; počítadlo nahoře ukazuje „zbývá N“.
- **Vrátit poslední hodnocení fotky** (Backspace nebo klik ve stavové liště): srdíčka se zruší a fotka se vrátí na své místo.

## [1.0.12] – 2026-11-01

### Opraveno
- **Hodnocení fotek v prohlížeči (Hodnocení › Fotky):**
  - Podržená číslice ohodnotí jen jednu fotku (dřív mohla projet celou frontu); ohodnocená fotka vypadne hned a zápis běží za ní, takže rychlé „3“ a „4“ jdou každá na jinou fotku. Nepovedený zápis vrátí fotku na místo. Klávesa 0 ve frontě nehodnocených nic nezapíše.
  - Zamíchání (S) už nevrací ohodnocené fotky; lišta alb se ve frontě nehodnocených neukazuje (u velké sbírky zpomalovala každé hodnocení).
  - Po zavření prohlížeče se fronta načte až po dopsání hodnocení a souběžné načtení se neztratí – počet a náhledy sedí.
  - Hodnocení fotek kdekoli (i v pásech Porovnat) hned upraví počet nehodnocených v hlavičce a stavové liště.
- **Náhodné pořadí fotek** zůstává stejné po celé spuštění, i když ohodnocené ubývají – na frontu se dá navázat.

### Změněno
- Mimo Fotky se načítá jen počet nehodnocených fotek jedním dotazem; celý seznam až ve Fotkách (rychlejší otevření Hodnocení u velké sbírky).

## [1.0.11] – 2026-11-01

### Přidáno
- **Série dní v řadě** ve stavové liště Porovnat: „🔥 5 dní v řadě“ – kolik dní za sebou jsi aspoň jednou porovnával (počítá se z uložených porovnání). Když dnes ještě žádné porovnání není, série platí do včerejška a lišta oranžově připomene „dnes ji prodluž“; první dnešní porovnání ji prodlouží hned.

## [1.0.10] – 2026-11-01

### Změněno
- **Hodnocení › Fotky bez zdvojených údajů:** z karty zmizel nadpis, návod na klávesy, číslo modelek a tlačítka Prohlížet a hodnotit / ▶ Promítat – tlačítka jsou v hlavičce Hodnocení, klávesy a počty („56 fotek bez srdíček · 8 modelek“) ve stavové liště. Náhledy fronty jsou přes celou šířku a vyšší, klik otevře prohlížeč; Jen jedna modelka a Dál na řadě zůstávají.

## [1.0.9] – 2026-11-01

### Změněno
- **Porovnat má pásy přes celou výšku okna** (přepracování Porovnat, krok 2).
  - Z hlavičky Hodnocení zůstala v Porovnat jen lišta částí, vpravo **⚔ Rozhodnout** a Tipy · Trendy · Jak počítám.
  - Důvod dvojice a místa obou modelek v pořadí jsou jeden **štítek na švu** mezi pásy („⚔ O postup do Top 10 · 10. Marta ↔ 11. Anna ⏳“); celý důvod v bublině.
  - Velké **♥ Tahle** pod jménem, výraznější aktivní pás (zvýrazněná fotka jen v něm), prohraná strana se po volbě odbarví.
  - **Stavová lišta**: vlevo ukazatel dne (dílky k další desítce) a kdo vede sezónu; vpravo po volbě „✓ Bára > Cecílie“ a pak „↶ Vrátit“, návrh srdíček (Ano · Ne – dřív pod pásy mimo obrazovku), odkaz na to, co čeká jinde, a klikatelné klávesy ↵ Tahle · ↓ Stejně · S Přeskočit. V užším okně napřed zmizí odkazy a sezóna, pak popisky kláves.

## [1.0.8] – 2026-11-01

### Změněno
- **Vyhlášení sezóny ve „3D“:** stupně vítězek vystupují do prostoru – boční fotky natočené k jedničce přesahují přes okraj okna, jednička vystoupí dopředu s korunou a září, pod nimi světlo jako podlaha a fotky při otevření přilétnou. Fotky jsou ve vlastních rámečcích, takže uložený výřez se zvětšením už nepřetéká přes text; avatary Miláčka jsou oříznuté do kroužku. V užším nebo nižším okně je přesah menší.

### Opraveno
- **Porovnat** (přepracování Porovnat, krok 1):
  - Vrátit ze stránky „Dvojice došly“ už nespadne; Vrátit smaže jen dvojici, kterou ukazuje lišta (jinak nic a stará historie se zahodí).
  - Smazané nebo skryté modelky zmizí z fronty i historie; přepočty pořadí se neprolínají (starší výsledek nepřepíše novější) a fronta se doplňuje jednou naráz.
  - Po volbě odejde jen zobrazená dvojice (série „Rozhodnout teď“ nepřijde o souboj), vrácený souboj nechá sérii otevřenou a po Vrátit či Přeskočit se už neukáže zastaralý návrh srdíček.
  - Enter na tlačítku v hlavičce nebo ve stavové liště nezapíše volbu.
  - Hlavička a stavová lišta se po porovnání obnoví jednou místo třikrát; úklid nepoužívaného kódu.

## [1.0.7] – 2026-11-01

### Změněno
- **Pozor: Sbírka je teď na Ctrl+5.** Sekce jdou zleva doprava Modelky · Čísla · Hodnocení · **Síň slávy (Ctrl+4)** · Sbírka (přepracování Hodnocení, krok 4).
- **Nápověda a klávesové zkratky** (?) popisují nové hlavičky Hodnocení a Síně slávy: klávesa **I** otevře a zavře panel vpravo (Hodnocení: Tipy · Trendy · Jak počítám, Síň slávy: Na dosah · Minulé sezóny · Pravidla), Esc ho zavře; pohledy Pořadí Celé pořadí · Čekají · Nesedí, filtr Kroniky v liště a stav ve stavové liště.

## [1.0.6] – 2026-11-01

### Změněno
- **Síň slávy je vlastní sekce** (přepracování Hodnocení, krok 3). Kapsle: **Modelky · Čísla · Hodnocení · Síň slávy · Sbírka** – Síň slávy je **Ctrl+4**, **Sbírka se posunula na Ctrl+5**.
  - Hlavička jako Hodnocení a Sbírka: fotka jedničky s ♛, čísla (v Top 10, legendy, odznaky, rekordy), okénka **Sezóna** (kdo vede, kolik zbývá) a **Na dosah** (nejbližší stupeň odznaku); akce **⚔ Vyzvat o trůn**, **♛ Vyhlásit sezónu** (když čeká) a **Porovnat →**. Po odrolování jeden řádek.
  - Lišta pohledů **Top 10 · Sezóna · Legendy · Odznaky · Rekordy · Kronika**; filtr Kroniky je vpravo v liště.
  - **Panel vpravo** (klávesa **I**, Esc zavře): **Na dosah**, **Minulé sezóny** a **Pravidla**.
  - Pohled Sezóna bez vlastní druhé hlavičky a karty vyhlášení, Top 10 bez řádku Na dosah a popisné věty (vše je v hlavičce nebo v panelu).

## [1.0.5] – 2026-11-01

### Změněno
- **Hodnocení má hlavičku jako Sbírka a profil modelky** (přepracování Hodnocení, krok 2).
  - Hlavička: kruh **dnes** (porovnání z denního cíle), čísla (v pořadí, se srdíčky, fotek bez srdíček, kolik čeká) a vpravo okénka **Top 10** a **Sezóna** – klik otevře Síň slávy na tom pohledu.
  - Akce **⚔ Rozhodnout čekající · Hodnotit fotky · ▶ Promítat · Ověřit srdíčka** (jen když je co dělat).
  - Lišta **Porovnat · Fotky · Pořadí · Síň slávy** a vpravo pohledy části; pilulky částí zmizely z horní kapsle. Po odrolování se hlavička zmenší na jeden řádek.
  - **Panel vpravo** (klávesa **I**, Esc zavře): **Tipy** (Mohlo by se ti líbit), **Trendy** (Stoupají a klesají) a **Jak počítám** (model vkusu, zájem, pravidla úrovní).
  - **Pořadí** bez kompaktního Top 10 (je v Síni slávy) a bez karty Čeká na rozhodnutí: pohledy **Celé pořadí · Čekají · Nesedí**; upozornění na nesoulad ve stavové liště otevře Nesedí.

## [1.0.4] – 2026-11-01

### Změněno
- **Hodnocení a Síň slávy: stav ve stavové liště** (přepracování Hodnocení, krok 1).
  - **Porovnat:** vlevo dnešní porovnání a sezóna (kdo vede, kolik dní zbývá), vpravo upozornění s odkazem, **↶ Vrátit** s poslední dvojicí a klávesy. Bublina „⌨ Klávesy“ pod pásy je pryč.
  - **Fotky:** počet a klávesy prohlížeče (1–5 srdíčka, šipky, mezerník promítat, Esc).
  - **Pořadí:** počet modelek, kolik čeká na potvrzení a kolik nesedí, vpravo odkaz do Porovnat.
  - **Síň slávy:** den sezóny a kdo vede; vpravo sezóna čekající na vyhlášení (Vyhlásit →), jinak poslední zápis kroniky (Kronika →). Zdvojené počty („10 modelek v Top 10“) zmizely.
  - V úzkém okně klávesová nápověda ubývá po celých úsecích, stav vlevo zůstává celý.

## [1.0.3] – 2026-11-01

### Změněno
- **Sbírka: panel vpravo** (přepracování Sbírky, krok 3) jako Údaje u profilu modelky. Otevírá se tlačítky v hlavičce Sbírky (**Čísla a sháním · Statistiky · Učení**), záložkami v panelu nebo klávesou **I**; Esc, × nebo I ho zavře. Fronta Údržby zůstává vidět a panel se pamatuje.
  - **Čísla a sháním:** sháněná čísla CZ (Kopírovat seznam ve stavové liště) a mapy výtisků CZ a archivu US; prázdné „Nic nesháníš“ je jen krátký řádek.
  - **Statistiky:** graf a seznam pod sebou, graf a filtry v kapsli vpravo nahoře, dokud je panel otevřený.
  - **Učení:** Co se program naučil (už ne nad frontou).
  - Dříve uložená část Úvod, Sháním CZ nebo Statistiky se otevře jako panel nad Údržbou; mapa sekcí a odkazy odjinud otevřou správný panel.

## [1.0.2] – 2026-11-01

### Změněno
- **Sbírka je jedna stránka s hlavičkou jako profil modelky** (přepracování Sbírky, kroky 1 a 2).
  - Hlavička: kruh s procentem doplnění, čísla sbírky (modelky, alba, fotky, čísla, úkoly) a vpravo oblasti Modelky / Alba / Čísla; akce + Přidat ▾, Importovat, Exportovat, Zkontrolovat soubory a Mapa čísel · Sháním CZ · Statistiky (zvolená svítí, další klik vrátí Údržbu); lišta s filtry fronty a jejich počty (u Návrhů a Ke kontrole i zdroje) a vpravo pohledy Po údajích · Po modelkách · Fronta. Po odrolování se hlavička zmenší na jeden řádek.
  - Sbírka (Ctrl+4) se otevírá v Údržbě; části Úvod, Údržba, Sháním CZ a Statistiky už nejsou v navigační kapsli (v mapě sekcí ano).
  - **Bez zdvojených údajů:** zmizel nadpis Údržby, kruh a pruhy pokroku v Souhrnu, boční seznam filtrů a texty o doplnění ve stavové liště. Úvod se jmenuje **Mapa čísel** a má jen mapy CZ a US (počty v nadpisech) a naposledy přidané; dlaždice s čísly, Co zbývá doplnit, karta Hodnocení a grafy výtisků a desetiletí jsou pryč (čísla jsou v hlavičce, hodnocení v sekci Hodnocení, desetiletí ve Statistikách).

## [1.0.1] – 2026-11-01

### Změněno
- **Profil modelky: jeden panel v hlavičce.** Pruh s modelkou je součástí panelu s drobečky: drobečky, fotka, jméno, srdíčka, pořadí, odznaky, pásky čísel, řádek akcí a pod nimi lišta alb; stránka začíná rovnou alby a jméno se neopakuje.
  - Po odrolování se panel plynule zmenší na jeden řádek (drobečky, malá fotka, jméno, srdíčka, akce) a lišta alb zůstane pod ním; nahoře se zase rozbalí.
  - U profilu otevřeného ze seznamu otevře klik na jméno (▾) nabídku modelek seznamu.

## [1.0.0] – 2026-11-01

První vydání milníku 1 (Pohodlí a kvalita dat). Stejné vydání krátce vyšlo s neplatným číslem 0.99.100 (pravidlo verzování povoluje PATCH nejvýš 99).

### Změněno
- **Filtr Modelek v panelu pod tlačítkem Filtry** v kapsli voleb vpravo nahoře (místo štítků v hledání z 0.99.99).
  - Vlevo seznam filtrů: Srdíčka, Edice, Kategorie, Výskyt, Vlasy, Oči, Národnost, Tagy, Rok vydání, Rok narození, Výška, Váha, Tetování, Piercing; zapnutý má tečku a hodnotu.
  - Vpravo editor zvoleného: **je / není**, zaškrtávání hodnot s počtem modelek, které s ostatními filtry a hledáním zbudou, u roků, výšky a váhy předvolby a rozsah od–do, u srdíček ♥ 1+ … ♥ 5 a Bez ♥.
  - Dole kolik modelek se zobrazí a Zrušit filtry. Zapnuté filtry jsou štítky ve stavové liště (klik otevře panel na filtru, × zruší); filtr se pamatuje i po restartu.
- **Hledání je zase obyčejné pole**: bez štítků a bez řádku rychlých filtrů; příkazy jako `vlasy:blond` v něm fungují dál. Filtry uložené ve verzi 0.99.99 se převezmou do panelu.

## [0.99.99] – 2026-11-01

### Změněno
- **Filtry v Modelkách jako štítky v kapsli hledání** (přepracování filtru, kroky 1 a 2).
  - Příkaz `vlasy:blond`, `narodnost:usa,kanada`, `rok:1990..1999`, `hodnoceni:>=3,5`… se po mezeře nebo Enteru změní ve štítek; v poli zůstane jen hledaný text. Backspace v prázdném poli vrátí poslední štítek k úpravě.
  - Pod kapslí řádek rychlých filtrů: Srdíčka, Edice, Kategorie, Výskyt, Vlasy, Národnost, Rok vydání, Výška a + Další (oči, tagy, rok narození, váha, tetování, piercing).
  - Editor filtru (klik na štítek nebo tlačítko): **je / není**, zaškrtávání více hodnot s počtem modelek, které s ostatními filtry zbudou, hledání v hodnotách, u roků desetiletí a rozsah od–do, u výšky a váhy pásma, u srdíček ♥ 1+ … ♥ 5 a Bez ♥.
  - Tlačítko **Filtry** v kapsli voleb s počtem filtrů otevře řádek hledání s filtry; stavová lišta ukazuje každý filtr zvlášť (klik upraví, × zruší), Zrušit filtry zruší vše.
  - Filtr Modelek si program pamatuje i po přepnutí přehledu a po restartu. Starý panel Filtry v Modelkách nahradily štítky.
- Společný model filtru (`lib/filtr.js`, `lib/dimenze.js`); stejné dotazy najdou totéž v Go i ve frontendu (testy nad `testdata/hledani-shoda.json`).

## [0.99.98] – 2026-11-01

### Opraveno
- **Hledání a filtry (krok 0 přepracování filtru).**
  - NEBO s víceslovnou hodnotou: `kategorie:playmate,"cyber girl"`, `vlasy:"strawberry blond",černá`.
  - Srdíčka mají všude stejný význam jako v hledání modelek: `hodnoceni:>=3,5` už se v Nejlepších a Centerfoldech nerozpadne, `hodnoceni:3,5` = 3½, `hodnoceni:4` = přesně 4, `hodnoceni:3..4` rozsah.
  - `edice:` počítá i obálky, stejně jako filtr Edice v panelu.
  - Příkaz, který přehled nezná (`vlasy:` na Číslech), se už tiše nepřeskočí: stavová lišta ukáže „⚠ vlasy: tady nefiltruje“.
  - Hledání, které omezuje přehled, je ve stavové liště štítkem (klik skočí do pole, × hledání smaže); „Zrušit filtry“ zruší naráz filtry i hledání.
  - Filtr srdíček v Modelkách už nepřepíná řazení.

## [0.99.97] – 2026-11-01

### Přidáno
- **Stavová lišta dole přes celé okno.**
  - Vlevo počet a stav zvolené části: „8 z 22 modelek“ (s filtrem nebo hledáním), „Dnes 0 z 10“, „79 % sbírky doplněno · 29 úkolů“, v profilu „56 fotek · 14 alb“, v Údržbě úplnost, úkoly a co je ke kontrole.
  - Za ním zapnuté filtry jako štítky: klik otevře Filtry, × filtr zruší, „Zrušit filtry“ zruší všechny.
  - Vpravo upozornění s odkazem („≠ 2 modelkám nesedí srdíčka · Pořadí →“), jinak nápověda ke klávesám.

### Změněno
- **Kapsle voleb vpravo nahoře má jen ovládání** (řazení, Filtry s počtem zapnutých); počty, štítky filtrů a upozornění jsou ve stavové liště. Oznámení a lišta výběru fotek stojí nad stavovou lištou.
- **Pořadí a Fotky mají záhlaví stránky** jako Síň slávy a Údržba; přepínače Top 10 · Celé pořadí a Náhodně · Po modelkách jsou v něm.

## [0.99.96] – 2026-11-01

### Změněno
- **Pohledy částí v záhlaví stránky.** Síň slávy (Top 10 … Sezóna) a Údržba (Po údajích · Po modelkách · Souhrn) mají nahoře na stránce štítek sekce, velký nadpis, úvodní větu pohledu a vpravo kapsli pohledů; řádek podmenu pod navigační kapslí zmizel. V užším okně mají nezvolené pohledy jen ikonu.
- **Mapa sekcí**: klik na zvolenou sekci v navigační kapsli otevře panel se všemi sekcemi, jejich částmi i pohledy (Síň slávy › Kronika, Údržba › Po modelkách…); klik přenese rovnou tam, Esc nebo klik mimo zavře.
- **Hlavní nabídka ⋯** je všude stejná: akce s modelkou jsou v profilu v pruhu s modelkou. **Přejmenovat fotografa a tag** se přesunulo z Nastavení do Sbírka › Údržba › Souhrn › ⋯ Hromadně („Napříč sbírkou“).

## [0.99.95] – 2026-11-01

### Přidáno
- **Úprava výřezu titulní fotky přímo v profilu**: tlačítko v rohu velké fotky v panelu Údaje nebo ⋯ › Upravit výřez titulní fotky. Rám má při úpravě tvar karty v galerii; po uložení se obnoví i miniatura v pruhu.

### Změněno
- **Drobečky sjednocené s navigační kapslí** (stejné sklo a oddělovač „›“).
  - Zpět ukazuje celou cestu, odkud se přišlo („← Hodnocení › Pořadí“, „← Modelky › Profily“, jméno modelky, číslo) a vede přesně tam.
  - Místo, kde jsem, svítí růžově; u profilu otevřeného ze seznamu (▾) otevře nabídku modelek seznamu.
  - U čísla je před ním jeho ročník („Ročník 1975“, klik otevře celý ročník).
  - Krokování „‹ 3 z 22 ›“ za tenkou čárou; v užším okně jen šipka zpět.
- **Hledání**: kapsle má vždy vlastní řádek pod drobečky a obsah odsune, místo aby ho překrývala; výsledky plují pod ní.
  - Text, který omezuje přehled (třeba `vlasy:blond` v Modelkách, hledání ve frontě Údržby), drží řádek otevřený: Esc ani lupa ho neschovají, kapsle má růžový obrys. Na profilu a čísle se řádek schová a po návratu je zpět; zavřít jde po smazání textu (×).

## [0.99.94] – 2026-11-01

### Změněno
- **Stránka modelky – úpravy pruhu s modelkou.**
  - **Srdíčka** jsou hned vedle jména; pod jménem pořadí a odznaky.
  - **★ Centerfold** je v pruhu vždy: s centerfoldem růžová hvězdička a klik ho otevře v prohlížeči, bez něj jen bílý obrys a tlačítko je vypnuté („Modelka zatím nemá centerfold“).
  - **Vybrat** už není tlačítko v pruhu: výběr fotek se zapne v nabídce ⋯ („Vybrat fotky“, když běží „Ukončit výběr fotek“); Esc ho ukončí, Ctrl/Shift+klik funguje dál.

## [0.99.93] – 2026-11-01

### Změněno
- **Stránka modelky – akce v pruhu s modelkou, centerfold jako tlačítko.**
  - Akce (Údaje · Upravit · Přidat fotky · Promítat · Vybrat · ⋯ a počet fotek a alb) jsou spodním řádkem pruhu s modelkou, uprostřed; kapsle vpravo nahoře je v profilu prázdná. V úzkém okně jen ikony.
  - **★ Centerfold** je tlačítko v pruhu, které otevře centerfold v prohlížeči (víc centerfoldů: ↑ ↓ mezi nimi). Z galerie i lišty alb zmizel; jeho akce jsou na pravém tlačítku a v ⋯ („Centerfold Únor 1971…“).

## [0.99.92] – 2026-11-01

### Změněno
- **Stránka modelky – nové rozložení (galerie přes celou šířku).**
  - **Pruh nahoře** s miniaturou, jménem, srdíčky, pořadím, odznaky a páskami čísel.
  - **Panel Údaje** (tlačítko Údaje, klávesa <kbd>I</kbd> nebo klik na miniaturu) se vysune zprava: velká fotka, údaje, tagy, poznámka, články a odkazy. Program si pamatuje, zda je otevřený.
  - **Akce s modelkou v kapsli vpravo nahoře:** Údaje · Upravit · Přidat fotky · Promítat · Vybrat · ⋯ (promítat, sloučit, smazat) a počet fotek a alb; v užším okně jen ikony.
  - **Lišta alb** je ve druhém řádku vedle drobečků, zvolené album plnou růžovou; drobečky jsou jedna kapsle.
  - **Centerfold je první album galerie** s hlavičkou a ⋯, v liště alb jako „★ Centerfold“.
  - **Režim Vybrat:** klik fotky vybírá (kroužky na dlaždicích), <kbd>Esc</kbd> nebo Zrušit ho ukončí; Ctrl/Shift+klik funguje dál.
  - Tlačítko ⋯ u alb je vidět trvale, štítky v hlavičce alba jsou kapsle. Nápověda a přehled zkratek doplněny.

## [0.99.91] – 2026-11-01

### Změněno
- **Stránka modelky – rychlejší a úspornější kód (vzhled a chování beze změny).**
  - Zkracování alb na náhled přepočítá rozvržení stránky jednou, ne za každé album; rychlejší otevření profilu s mnoha alby a změna velikosti okna (nejvýš jednou za snímek).
  - Tažení fotky při ručním řazení už při každém pohybu myši neprohledává celou stránku.
  - Profil, prohlížeč fotek, lišta výběru a akce fotky hledají stálé prvky jednou; duplicitní šablony a výpočty sloučeny.
  - Styly profilu a lišty alb bez deklarací, které pozdější pravidla přepisovala (o 50 řádků méně).

## [0.99.90] – 2026-11-01

### Změněno
- **Navigační kapsle – fúze hlavního menu, částí a voleb.**
  - **Čtyři sekce:** Modelky (Profily · Galerie), Čísla (Obálky · Kalendář · Centerfoldy), Hodnocení (Porovnat · Fotky · Pořadí · Síň slávy) a Sbírka (Úvod · Údržba · Sháním CZ · Statistiky).
    - Zvolená sekce se v kapsli rozbalí na své části, nezvolené jsou jen ikony.
    - Klik na zvolenou sekci otevře nabídku všech sekcí i s částmi.
    - <kbd>Ctrl</kbd>+<kbd>1</kbd>–<kbd>4</kbd> otevřou sekce.
  - **Pohledy části** (Síň slávy: Top 10 … Sezóna, Údržba: Po údajích · Po modelkách · Souhrn) jsou v podmenu v druhém řádku. Kapsle voleb vpravo nahoře má jen řazení, filtry a počet. Lupa, + a ⋯ jsou v řádku okna.
  - **Sdílený průsvitný panel:** druhý řádek (podmenu, drobečky profilu a čísla) má sklo jako hledání.
    - Lupa v něm otevře kapsli hledání vedle podmenu nebo drobečků, výsledky plují pod panelem.
    - Když se kapsle nevejde, otevře se v řádku pod panelem.
    - Bez podmenu a drobečků se řádek nezobrazuje a hledání má vlastní plovoucí řádek.
  - V užším okně mají nezvolené části jen ikonu, v nejužším zůstane jen zvolená část.

## [0.99.89] – 2026-10-31

### Přidáno
- **Sezóny oblíbenosti (krok 1): Síň slávy › Sezóna.** Každý kalendářní měsíc je sezóna. Modelky v ní sbírají body formy, které nemění sílu ani pořadí oblíbenosti.
  - **Body:**
    - výhra v Porovnat +3, remíza +1, výhra nad silnější (výš v pořadí) +2 navíc;
    - zájem: den s otevřeným profilem +1, každé 2 minuty nad fotkami +1, nejvýš 4 denně a nejvýš polovina bodů (rozhodují souboje);
    - o titul soutěží modelky s aspoň 3 souboji.
  - **Pohled Sezóna:**
    - řádek sezóny s odpočtem měsíce;
    - trůn první trojice ve stejných kartách jako Top 10 (u 2. a 3. „⚔ Vyzvat o trůn“ zařadí souboj s vedoucí do Porovnat);
    - pořadí se složením bodů (souboje · zájem) a trendem za týden;
    - pravidla a minulé sezóny.
  - **Vyhlášení:** po skončení měsíce se při spuštění otevře okno s **Favoritkou sezóny** (nejvíc bodů) a stupni 1–3 a s nepovinnou volbou **♥ Miláčka sezóny**. „Později“ vyhlášení odloží a vyhlásit jde i z pohledu Sezóna.
  - Favoritka a Miláček se zapíšou do kroniky (filtr Sezóny) a tituly Favoritky dávají odznak 👑 Favoritka (1×, 3×, 6×). Vrácení porovnání je nesmaže, „Zapomenout porovnání“ ano.
  - V kapsli pohledů Síně slávy přibyla Sezóna se stavem „vede … · zbývá N dní“.

## [0.99.88] – 2026-10-31

### Opraveno
- Sbírka › Statistiky po návratu z jiné části (Úvod, Údržba, Sháním CZ) nezůstanou viset na „Počítám statistiky…“ – spočítají se znovu.

## [0.99.87] – 2026-10-29

### Změněno
- **Moderní segmentový přepínač hlavních sekcí ve stylu Linear / macOS:**
  - Horní přepínač `#viewToggle` v záhlaví okna byl přepracován na kompaktní segmentový ovladač se zaobleným kontejnerem (`border-radius: 10px`, skleněný blur a jemný okraj).
  - Aktivní segment vystupuje s jemným vyvýšením (`box-shadow`), zvýrazněným pozadím a růžovou ikonou sekce (`var(--accent)`).
  - Byla odstraněna problematická polopilulka a rohová napojení (corner fillets) – navigace má nyní čistou, moderní a čitelnou dvouúrovňovou hierarchii (1. úroveň: segmentový přepínač Modelky / Čísla / Sbírka v záhlaví okna; 2. úroveň: kapslové pilulky podsekcí v liště `#pasStranky`).

## [0.99.86] – 2026-10-29

### Změněno
- **Aktivní záložka jako půl-pilulka plynule napojená na spodní lištu nabídek:**
  - Nezvolené záložky v horní liště (`#viewToggle`) jsou čisté bez rámečků a pozadí.
  - Pouze vybraná záložka má tvar půl-pilulky (horní zaoblení pilulky `border-radius: 19px 19px 0 0`) s horním akcentním podsvícením a její spodní hrana je otevřená a přímo spojená se spodní nabídkou (`.hlavni-lista`).
  - Propojení záložky a spodní lišty je doplněno plynulými postranními zaobleními (corner fillets), takže horní záložka a spodní lišta tvoří jeden propojený celek.

## [0.99.85] – 2026-10-29

### Změněno
- **Sjednocení designu horního menu na kapsli („tabletku“):**
  - Horní nabídka hlavních sekcí (`#viewToggle` – Modelky, Čísla, Sbírka) má nyní totožný kapslový vzhled („tabletku“) jako lišta podčástí pod ní (`#pasStranky` / `.slava-pohledy`): plně zaoblený kontejner (`border-radius: 999px`), poloprůhledné pozadí se skleněným rozostřením, jemný okraj a aktivní záložku se zvýrazněním ve firemní růžové barvě (`var(--accent)`). Obě úrovně nabídky tak mluví stejným vizuálním jazykem.

## [0.99.84] – 2026-10-29

### Změněno
- **Zjednodušení hlavního menu na 3 sekce se záložkovým vzhledem prohlížeče a reorganizace podčástí:**
  - V horním řádku okna (`.titulek-okna`) zůstaly jen 3 hlavní sekce: **Modelky** (`Ctrl+1`), **Čísla** (`Ctrl+2`) a **Sbírka** (`Ctrl+3`).
  - Horní záložky opustily kapslový vzhled – nezvolené mají čistý text s ikonou a zvolená má tvar záložky prohlížeče, která se na spodní hraně přelévá přímo do kontextové lišty (`.hlavni-lista`).
  - Kontextová lišta pod nimi si zachovala kapslový design pilulek (`#pasStranky`):
    - Pod **Modelky** se přesunuly: **Profily** (výchozí galerie modelek), **Galerie** (přejmenováno z *Nejlepší*) a **Síň slávy**.
    - Pod **Čísla** se jako pilulky sjednotily: **Obálky**, **Kalendář** a **Centerfoldy**.
    - Pod **Sbírku** se k existujícím částem (**Úvod**, **Údržba**, **Sháním CZ**, **Statistiky**) přesunuly hodnotící nástroje: **Porovnat**, **Hodnotit fotky** (přejmenováno z *Fotky*) a **Pořadí**.

## [0.99.83] – 2026-10-29

### Změněno
- **Kapsle voleb a filtrů vpravo nahoře:** volby přehledu (`#volbyPrehledu` – řazení, srdíčka, filtry, počet) se přesunuly z kontextové lišty do horního řádku okna na pravou stranu, oddělené od hlavních záložek (Modelky, Čísla, Centerfoldy, Oblíbenost, Sbírka) volným místem a svislou čarou před tlačítky okna. Kontextová lišta pod nimi drží jen drobečky, pilulky podčástí a akce (lupa, `+`, `⋯`).

## [0.99.82] – 2026-10-29

### Změněno
- **Celošířková vícesloupcová mřížka našeptávače a chytřejší globální hledání:**
  - Když našeptávač (`#naseptavac`) najde výsledky ve více skupinách (**Modelky**, **Čísla**, **Články**, **Fotografové**), rozloží je vedle sebe do sloupců přes celou šířku průsvitného pruhu (`#hledaniRadek`), s možností přecházet mezi sloupci šipkami `←` a `→`.
  - V našeptávači přibyla skupina **Fotografové** (otevře stránku fotografa) a doplňování hodnot filtrů (`ziskatMoznostiHodnot`) nově podporuje i příkazy `fotograf:`, `prsa:`, `misto:`, `etnicita:`, `ochlupeni:`, `narozena:`, `nafoceno:`, `vyska:`, `vaha:`, půlsrdíčka u `hodnoceni:` a vícenásobné hodnoty oddělené čárkou (`vlasy:blond,zrz`).
  - Vylepšeno řazení výsledků v našeptávači (přednost shody od začátku jména modelky či názvu čísla, prohledávání všech údajů modelky s mezipamětí `WeakMap` a automatickou invalidací `poZmeneDat`).
  - Otevření modelky, čísla, článku nebo fotografa z našeptávače automaticky skryje pruh hledání (`#hledaniRadek`), aby nezakrýval nově otevřenou stránku, a psaní do hledání na profilu či stránce čísla už nevytrhává uživatele po 180 ms pryč do galerie.

## [0.99.81] – 2026-10-29

### Změněno
- **Sjednocená průhlednost pruhu hledání a výsledků hledání v jednom pruhu:**
  - Pruh hledání (`#hledaniRadek`) pluje přímo přes horní okraj obsahu stránky (`position: absolute; top: 100%`), takže rozmazává obsah pod sebou se stejným průsvitným skleněným vzhledem jako nabídka výsledků hledání.
  - Kapsle vyhledávacího pole nemá vlastní tmavé neprůhledné pozadí (`var(--panel-bg)`), ale jemný skleněný povrch (`rgba(255, 255, 255, 0.05)`) sladěný s položkami výsledků.
  - Nabídka výsledků hledání (`#naseptavac`) se při psaní rozbaluje přímo uvnitř pruhu hledání jako jeho součást místo samostatného plovoucího boxu pod ním.

## [0.99.80] – 2026-10-29

### Změněno
- **Přepínač lupy v kontextové liště a průsvitný řádek s kapslí hledat uprostřed:**
  - Tlačítka přidání (`+`) a dalších akcí (`⋯`) jsou přesunuta do druhého řádku hlavičky (`.hlavni-lista`) na pravý okraj spolu s přepínačem lupy (`#searchToggleBtn`) ve stejném designu (`.nav-fav`).
  - Ve skrytém stavu má tlačítko lupy stejnou barvu jako `+` a `⋯`, v zobrazeném stavu svítí růžově (`var(--accent-text)`).
  - Kliknutí na lupu (nebo `Ctrl+F`) zobrazí a skryje třetí řádek (`#hledaniRadek`) se stejnou výškou jako řádek tlačítek, průsvitným skleněným pozadím jako kontextové nabídky a vyhledávací kapslí uprostřed.

## [0.99.79] – 2026-10-29

### Změněno
- **Rychlejší načítání, filtrování a vykreslování stránky Modelky:**
  - Při otevření galerie bez hledaného dotazu a při přepínání řazení nebo filtrů (srdíčka, edice, kategorie, výskyt) se modelky filtrují přímo z mezipaměti bez zbytečného volání backendu (`GetModelky`).
  - Četnosti kategorií a výskytu i odvozené údaje modelek pro filtrování se pamatují v mezipaměti a nepřepočítávají se při každém překreslení; zrušení všech filtrů proběhne v jednom kroku.
  - Značky částí (`data-cast`) pro rejstřík se vkládají rovnou do šablony karet bez druhého průchodu DOMem; nepřiblížené fotky (`coverZoom = 1`) nevytvářejí zbytečné kompozitní vrstvy (`transform: scale(1)`).
  - Uložení výřezu titulní fotky (`SetCoverVyrez`) aktualizuje zapamatovaný snímek sbírky v paměti přímo na místě bez znovunačítání všech tabulek z databáze.
- **Plynulejší posuvník, rejstřík a klávesové ovládání karet v galerii:**
  - Karty mimo obrazovku (`content-visibility: auto`) drží přesný poměr stran `3 / 4`, takže při rolování ani skoku přes rejstřík neposkakuje posuvník; rámeček zaměřené karty (`:focus-visible`) se neořezává.
  - Mezi kartami v mřížce lze přecházet šipkami `←`, `→`, `↑` a `↓` (včetně skoku o řádek nahoru a dolů ve stejném sloupci).
  - Hodnocení srdíčky na kartě při zapnutém filtru srdíček nepřekresluje celou galerii, dokud modelka filtr splňuje (karta neodskočí pod kurzorem a funguje dvojstisk číslice `1`–`5` pro půlsrdíčko).
  - V úzkém pravém rejstříku (`#galleryNav`) se popisky počtu fotek (`50+`, `20–49`, `1–19`) a srdíček (`4½ ♥`) zkracují bez přetékání a na kartě s dlouhým jménem zůstává šipka trendu vždy viditelná vedle zkráceného jména.

## [0.99.78] – 2026-10-29

### Změněno
- **Sjednocená dvouřádková hlavička a pět hlavních záložek (Varianta A + B):**
  - **Horní řádek (`.titulek-okna`):** pět hlavních záložek pohromadě vlevo (**Modelky**, **Čísla**, **Centerfoldy**, **Oblíbenost**, **Sbírka**, zkratky `Ctrl+1` až `Ctrl+5`), vpravo tlačítka akcí (`+`, `⋯`) a tlačítka okna (`–`, `□`, `×`).
  - **Druhý řádek (`.hlavni-lista`):** kontextová lišta otevřené sekce – vlevo návrat a drobečky na podstránkách (`.logo`), přepínač podčástí (`#pasStranky`) a volby přehledu, filtry a počty (`#volbyPrehledu`), vpravo vyhledávací pole (`.nav-controls`).
  - **Oblíbenost na jednom místě:** dřívější záložky *Nejlepší*, *Hodnocení* a *Síň slávy* jsou sjednocené pod záložkou **Oblíbenost** s pilulkami **Porovnat**, **Fotky**, **Pořadí**, **Síň slávy** a **Nejlepší** v kontextové liště; pohledy Síně slávy (*Top 10*, *Legendy*, *Odznaky*, *Rekordy*, *Kronika*) se přepínají přímo ve volbách lišty bez třetího plovoucího pásu v obsahu stránky.
  - **Sbírka bez plovoucího pásu v obsahu:** podčásti **Úvod**, **Údržba**, **Sháním CZ** a **Statistiky** i jejich stav a akce (*Kopírovat seznam*) jsou přímo v kontextové liště pod záložkami.

## [0.99.77] – 2026-10-29

### Opraveno
- **Tlačítka okna (minimalizovat, maximalizovat, zavřít)** v pravém horním rohu hlavičky jsou zase vidět: po omezení šířky drobečků vlevo (`.logo`) v 0.99.75 chybělo u `.window-controls` zarovnání doprava (`margin-left: auto`), takže se tlačítka posunula doprostřed pod pole hledání.
- V nejužším okně (do 420 px, kde je hledání skryté) využijí drobečky celou šířku až k tlačítkům okna a zamčená obrazovka lícuje se spodní hranou řádku okna (40 px).

## [0.99.76] – 2026-10-29

### Změněno
- **Statistiky ovládáš pod hledáním**, jako ostatní přehledy:
  - **Graf ▾** vybere graf;
  - ve Filtrech jsou Výskyt a Edice;
  - výběr z grafu je zapnutý filtr, který × zruší;
  - na konci je souhrn („22 modelek · 1971–1995“).
- **Údržba › Souhrn:** řazení fronty (⇅ podle priority ▾) a filtr **Vyřízené** jsou pod hledáním vedle režimů.
  - Vlastní pole hledání v Údržbě zmizelo, ve frontě hledá **hlavní hledání nahoře** („Hledat ve frontě Údržby…“).
  - ↓ nebo Enter z hledání skočí do fronty, Esc hledání zruší, do hledání vedou Ctrl+F i /.
- **Stránka fotografa:** filtr Vše / Centerfoldy / Pictorialy a alba je pod hledáním s počty, na konci je počet alb.
- **Zpět vede přesně tam, odkud jsi odešel**, i na konkrétní část. Jmenuje se podle ní („← Údržba“, „← Statistiky“, „← Sháním CZ“). U Hodnocení a Síně slávy nese název stránky.
- **Jednotné prázdné stavy:**
  - prázdná Top 10, Legendy, Sháním CZ, Statistiky bez modelek a dokončená fronta Po modelkách mají stejný vzhled s ikonou;
  - drobná hlášení uvnitř karet mají jeden společný styl.

### Opraveno
- V úzkém okně se lišta přizpůsobí při každé změně šířky a po načtení písma. Rejstřík u pravého okraje začíná pod skutečnou spodní hranou hlavičky a nezasahuje do lišty, když se zalomí.

## [0.99.75] – 2026-10-29

### Změněno
- **Nová horní lišta.** Vlevo jsou přehledy **Modelky · Čísla · Centerfoldy · Nejlepší**, vpravo stránky **Hodnocení · Síň slávy · Sbírka** (dřív „Přehled sbírky“), všechny jako záložky s ikonou a názvem. Za čárou zůstávají + a ⋯.
  - Klávesy **Ctrl+1 až Ctrl+7** otevřou záložky zleva doprava, fungují i na české klávesnici.
  - V užším okně mají nezvolené záložky jen ikonu (název ukáže bublina), zvolená má název vždy. Zkratky „Mod / Čís / Cf“ zmizely.
  - Klik na už zvolenou záložku jen vrátí stránku nahoru.
- **Pod hledáním jsou jen volby zobrazení a filtry** otevřené části: řazení a filtry přehledů, Obálky / Kalendář, ve Fotkách Náhodně / Po modelkách, v Pořadí Top 10 / Celé pořadí, v Kronice filtr událostí a v Údržbě režim Po údajích / Po modelkách / Souhrn. Na konci je počet („24 událostí“, „8 rekordů“).
- **Plovoucí pás stránek.** Hodnocení, Síň slávy a Sbírka mají nahoře v obsahu jeden společný pás: vlevo pilulky částí, vpravo stav stránky. Při rolování drží nahoře a zůstanou na něm jen pilulky.
  - Číslo v pilulce je jen to, co čeká na tebe (k porovnání, nehodnocené fotky, úkoly Údržby, sháněná čísla).
  - Síň slávy má v pilulkách ikony místo emoji.
  - Ve Sbírce je první část **Úvod** (dřív Přehled). Místo nadpisů „ÚDRŽBA“, „SHÁNÍM CZ“ a „STATISTIKY SBÍRKY“ je stav vpravo v pásu („79 % doplněno · 29 úkolů“, „Kopírovat seznam“).
  - Šipky ← → přepínají pilulky pásu i volby pod hledáním.
- **Hledání funguje i na stránkách Hodnocení, Síň slávy a Sbírka** („Najít modelku…“). Najde modelku, číslo nebo článek a Enter otevře první výsledek, i když ho zmáčkneš hned po napsání.
- **Cesta zpět v profilu a čísle:** vlevo nahoře je „← Hodnocení › Dana Nováková ‹ 3 z 10 ›“.
  - Šipky ‹ › listují seznamem, ze kterého jsi profil otevřel: galerií, pořadím nebo Top 10.
  - Z hledání nebo kroniky šipky nejsou.
- Nejlepší mají rejstřík hodnot u pravého okraje jako ostatní přehledy. Hodnocení ukazuje „Dnes 0 z 10“. V odkazech je všude „Porovnat →“.

### Opraveno
- Lišta nástrojů a levý sloupec Údržby se při rolování drží nahoře (pod pásem), jak měly.
- Přepnutí mezi Hodnocením a Síní slávy už nenačítá oblíbenost dvakrát.
- Po Ctrl+číslo nezůstanou pod hledáním staré výsledky.
- Odkaz „Porovnat a Pořadí →“ na úvodu Sbírky vždy otevře Hodnocení.
- Fokus se po volbě v liště neztratí a zaměřený prvek se neschová pod pás.
- Z čísla zmizela nepoužívaná lišta.

## [0.99.74] – 2026-10-29

### Změněno
- **Porovnávání, Galerie a Pořadí jsou sloučené do jedné části „Hodnocení“** se stejným vzhledem jako síň slávy. V liště Oblíbenosti zůstávají jen Hodnocení a Síň slávy.
  - Nahoře jsou pilulky **Porovnat · Fotky · Pořadí** s počty (čekající na potvrzení, nehodnocené fotky, nesoulady). Vpravo je „Dnes N“ s pruhem k příští desítce porovnání a odkazy na to, co čeká jinde („3 čekají na potvrzení → Porovnávat“).
  - **Porovnat:** vedle důvodu dvojice je pruh **Dvojice v pořadí**. Ukazuje místa obou modelek a jejich sousedek s úrovní a po přepočtu posun ▲▼. Klávesy a souboje fungují jako dřív.
  - **Fotky:** dlaždice s pěti velkými náhledy, velkými čísly (nehodnocené fotky, modelky) a tlačítky Prohlížet a hodnotit a ▶ Promítat. Nově jde prohlížet jen fotky jedné modelky. Pod dlaždicí je dalších 16 fotek fronty.
  - **Pořadí:** nahoře karta **Čeká na rozhodnutí** se souboji o úroveň (⚔ Rozhodnout teď) a nesoulady se srdíčky (Dát jí, Nechat, Ověřit). Pod ní je kompaktní Top 10 a „Celé pořadí s úrovněmi“ k rozbalení, vedle Stoupají a klesají s fotkami a Mohlo by se ti líbit.

## [0.99.73] – 2026-10-29

### Změněno
- **Nová síň slávy.** Nahoře jsou pilulky Top 10 · Legendy · Odznaky · Rekordy · Kronika (s počty). Každý pohled má vlastní stránku, nic se nehromadí pod sebou. Zvolený pohled si program pamatuje a vpravo v liště je poslední událost kroniky.
  - **Top 10:** stupně vítězů a místa 4–10. Klik na kartu rozbalí pod řadou **vitrínu modelky**: čísla, odznaky se stupni a postupem, co jí ještě chybí, její rekordy a kronika. Zavře ji ✕ nebo Esc, „Profil →“ otevře profil.
  - Pod Top 10 je řádek **Na dosah**: pět nejbližších dalších stupňů odznaků. Klik na položku otevře vitrínu.
  - **Odznaky** jako sbírka medailí: souhrn nahoře a karta pro každý odznak se stupni, fotkami držitelek a tím, kdo má nejblíž dalšímu stupni. Nezískané jsou zašedlé se zámkem. Dlouhý výpis odznaků dole zmizel.
  - **Rekordy** stojí jako poháry na polici, pod nimi jsou Rekordmanky. **Kronika** je časová osa s filtrem (vstupy a pády, jedničky, obhajoby, odznaky).
  - Řada odznaků v profilu otevře síň slávy rovnou na Odznacích.

## [0.99.72] – 2026-10-29

### Přidáno
- **Pictorialy Playmate of the Month a Playmate of the Year.** V okně alba je u Časopisu nově druh Pictorial, Playmate of the Month, Playmate of the Year a Centerfold (jako Cyber Girl of the Week / of the Month u online alb).
  - Pictorial Playmate of the Month dá modelce kategorii Playmate měsíce, i když centerfold ve sbírce nemá.
  - Pictorial Playmate of the Year dá kategorii **Playmate roku s rokem čísla**, ve kterém vyšel (bez čísla rok z názvu alba). Platí v kartách, filtrech, hledání `kategorie:` i v modelu vkusu.
  - Zapsaná kategorie Playmate roku má přednost. Návrh „Playmate roku z poznámky“ se u modelky s takovým pictorialem už nenabízí.
  - Údržba (Další návrhy) navrhne druh i u stávajících pictorialů. Podle názvu alba („Playmate of the Year 1998“, „PMOY“, „Playmate of the Month“) nebo když jde o jediný pictorial v čísle jejího centerfoldu (Playmate of the Month).

## [0.99.71] – 2026-10-28

### Změněno
- **Rekordy (🏆) mají stejnou bublinu jako odznaky.** Po najetí myší na trofej na kartě v síni slávy se ukáže, co rekord měří, kdo ho drží a s jakou hodnotou a jestli pořád roste. U rekordů, kde to dává smysl, je i datum (začátek vlády, vstup do Top 10, návrat, série, skok). Když pobyt začal před kronikou, bublina upozorní, že skutečná hodnota může být vyšší.
- Stupeň v bublině odznaku začíná velkým písmenem jen na začátku („Bronz · stříbro · zlato“).

## [0.99.70] – 2026-10-28

### Opraveno
- **Méně volného místa nahoře v Oblíbenosti i Přehledu.** Porovnávání, Galerie, Pořadí, Síň slávy a ostatní části Přehledu měly pod lištou o 20 px víc volna než zbytek programu. Mezeru dělalo prázdné místo pro volbu části, která je v liště. Obsah teď začíná stejně vysoko jako jinde.

## [0.99.69] – 2026-10-28

### Změněno
- **Bublina odznaků vypadá jako kontextové nabídky a hledání.** Má průsvitné sklo s rozmazáním, stejný okraj, zaoblení a stín. Nad stupni je růžový nadpis „Stupně“ s linkou jako nadpisy skupin v nabídkách.

## [0.99.68] – 2026-10-28

### Změněno
- **Lepší bublina u odznaků.** Po najetí myší na odznak (na kartě v síni slávy, v profilu, v oddílu Odznaky i v „Na dosah“) se ukáže vlastní bublina.
  - Obsahuje ikonu, název a stupeň a popis, co odznak měří a kolik má modelka.
  - Ukazuje všechny stupně s prahy (dosažené zaškrtnuté), ukazatel postupu („ještě 8 dní do stříbra“), soupeřku a datum zisku.
  - Funguje i na kartách v síni slávy, kde dřív přes odznaky vyskakovala jen bublina celé karty.

## [0.99.67] – 2026-10-28

### Změněno
- **Oblíbenost › Hodnocení je teď Galerie nehodnocených fotek.**
  - Panel ukáže, kolik nehodnocených fotek a modelek zbývá, a nabídne „Prohlížet a hodnotit“ a „▶ Promítat“. Pořadí je buď náhodně napříč modelkami, nebo po modelkách.
  - Fotky se otevřou v běžném prohlížeči. Když fotka dostane srdíčka (1–5 nebo klik), zmizí a hned se ukáže další. Hodnocené se v Galerii neobjevují.
  - Prohlížení v Galerii se nepočítá jako zájem o modelku.
  - Dosavadní rychlé hodnocení modelek jedna po druhé zmizelo, s ním i odkazy „Projít v Hodnocení“ a „Ohodnotit rychle“ v Pořadí.

## [0.99.66] – 2026-10-28

### Přidáno
- **Odznaky v síni slávy.** Osobní úspěchy modelek, které může mít víc modelek naráz.
  - Se stupni bronz / stříbro / zlato: 🏛 Stálice (30 / 100 / 365 dní v Top 10), ♛ Královna (7 / 30 / 100 dní na 1. místě), 🛡 Hradba (3 / 5 / 10 obhajob), 🔥 Série (5 / 10 / 20 výher za sebou) a ⚔ Zasloužená (25 / 50 / 100 porovnání).
  - Jednorázové: 🚀 Raketa (do Top 10 z místa za stovkou do 30 dní), 🔄 Comeback (návrat po aspoň 30 dnech), 🪨 David a Goliáš (z místa za Top 20 porazila jedničku), ⬆ Přeskočená laťka (porazila modelku s o celé srdíčko víc) a 🧊 Neporazitelná (30 dní v Top 10 bez prohry).
  - Na kartě je řada medailonů pod jménem a barva kroužku ukazuje stupeň. V profilu jsou pod pořadím a klik otevře Síň slávy.
  - Nový oddíl Odznaky ukazuje, kdo co má, a v „Na dosah“ kolik komu chybí k dalšímu stupni.
  - Zisk odznaku se zapíše do kroniky. Odznaky se dopočítají i zpětně z dosavadních porovnání a kroniky.
- **Nové rekordy:** nejdelší série výher, nejvíc porovnání a největší skok v pořadí za týden.

## [0.99.65] – 2026-10-28

### Opraveno
- **Síň slávy: kronika už nezačíná znovu a dny sedí.**
  - Vrácení porovnání (Backspace) mohlo smazat začátek kroniky, když kronika začala až po tom porovnání. Kronika pak začala znovu a všechny modelky v Top 10 byly „od dneška“. Začátek kroniky už vrácení nesmaže.
  - Dny v Top 10 a na 1. místě se počítají podle kalendáře. Modelka, která se dostala na 1. místo včera večer, má dnes ráno 1 den, ne „od dneška“.
  - Kdo byl v Top 10 už na začátku kroniky, má pobyt dopočítaný z denních snímků pořadí. Ukáže se tedy „aspoň 8 dní“ od dne, kdy se do Top 10 opravdu dostala, místo dne, kdy kronika začala. Stejně se dopočítá vláda jedničky.

## [0.99.64] – 2026-10-28

### Opraveno
- **Zájem o modelky se počítá poctivěji.**
  - Prohlížení fotek otevřené z Porovnávání nebo Rychlého hodnocení se už nepočítá jako zájem. Ty fotky ti ukázal program, takže modelky, které často páruje, už nesbírají zájem jen proto.
  - Kolik zájem v pořadí váží, se program učí z porovnání. Teď u každého porovnání bere jen zájem z doby před ním. Dřív bral i pozdější prohlížení, takže zájem vypadal užitečnější, než je, a mohl dostat vyšší váhu.
  - Pořadí uvnitř srdíček se tím může mírně posunout.

## [0.99.63] – 2026-10-28

### Změněno
- **Srdíčka fotek už neposouvají sílu modelky.**
  - Srdíčka fotky říkají, jak dobrá je fotka té modelky, ne jak moc se ti líbí modelka. Pětisrdíčková fotka jedničkové modelky ji proto už nevytáhne nad čtyřku.
  - Pořadí v Oblíbenosti dávají srdíčka modelky, porovnání a zájem. Bez porovnání je oblíbenost přesně srdíčka.
  - „Nesedí se srdíčky“ navrhuje změnu jen podle porovnání, ne podle fotek.
  - Nehodnocené modelky jen s hodnocenými fotkami už nejsou v Pořadí jako „odhad z fotek“. Odhad dává jen model vkusu.
  - Skóre fotek („fotky 4,3“) zůstává jako údaj u modelky a model vkusu z něj dál odhaduje hodnocení.
  - Pod Pořadím zmizela věta o naučené váze fotek.

## [0.99.62] – 2026-10-28

### Změněno
- **Hodnota fotky se odvíjí od srdíček modelky.**
  - Srdíčka fotky říkají, jak dobrá je fotka té modelky. Pro řazení fotek různých modelek se proto násobí oblíbeností modelky: hodnota = srdíčka fotky × srdíčka modelky ÷ 5.
  - Pětisrdíčková fotka pětkové modelky má hodnotu 5, pětisrdíčková fotka jedničkové jen 1.
  - Platí v Nejlepších fotkách, které mají oddíly po hodnotě („hodnota ♥♥♥♥♥“), i na stěně při řazení podle srdíček.
  - Filtr ♥ 3+ / 4+ / 5 dál vybírá podle srdíček fotky.

## [0.99.61] – 2026-10-28

### Změněno
- **Porovnávání si pamatuje tvoje rozhodnutí.**
  - Dvojice, ve které sis jednu vybral, se měsíc od posledního porovnání nenabídne znovu.
  - Remíza nebo vyrovnaný stav (každá jednou vyhrála) se vrátí jako rozstřel nejdřív za týden.
  - Dřív se dvojice mohla vrátit už po 200 dalších porovnáních. Kdyby v menší sbírce došly dvojice, nabídnou se ty starší než týden.

## [0.99.60] – 2026-10-28

### Opraveno
- **Porovnávání už nehází pořád tytéž modelky.**
  - Modelka z posledních porovnání nebo z dvojic, které právě čekají ve frontě, chvíli nedostane souboj ani ověření srdíček, ani jako soupeřka. Výjimkou je souboj o obhajobu.
  - Modelku, které nesedí srdíčka, program ověřuje jen do 10 porovnání se stranou nesouladu. Pak už důkazy má a návrh srdíček zůstává na tobě. Dřív ji nabízel v každé dávce.
  - „Rozhodnout teď“ a „Ověřit porovnáním“ vynechají nedávno porovnané dvojice a nezopakují dvojici, která už čeká ve frontě.
  - V simulaci klesl nejčastější výskyt jedné modelky z 84 na 27 dvojic na 1500 porovnání a přesnost pořadí se nezhoršila.

## [0.99.59] – 2026-10-27

### Změněno
- **Porovnávání je přehlednější.**
  - **Hlavička nad pásy:** vlevo proč tahle dvojice, u souboje nebo ověření se štítkem („⚔ O postup do Top 10“, „⚔ Ověření srdíček“). Vpravo „Nesedí se srdíčky“ a dnešní počet porovnání.
  - **Pod pásy jen tři tlačítka:** Vrátit, Obě stejně, Přeskočit. Přehled kláves ukáže „⌨ Klávesy“ po najetí myší.
- **Fotky v pásech mají pevnou výšku a šířku podle fotky:** fotka na šířku je širší, nic se neořízne. Platí v Porovnávání i v rychlém hodnocení.
- **Alba v profilu modelky jako mozaika:** řádky stejné výšky, šířka dlaždice podle poměru stran fotky. Dlouhé album zůstává sbalené na dva řádky. Poměry stran si program pamatuje, takže řádky při dalším otevření neposkakují.

## [0.99.58] – 2026-10-27

### Přidáno
- **Ověření srdíček porovnáním:** modelka, které nesedí srdíčka, dostává v Porovnávání cíleně soupeřky z úrovně, kam podle nesouladu patří. Podhodnocená trojka jde proti 3½ a čtyřkám, nadhodnocená proti 2½ a dvojkám. Nad pásy je štítek „⚔ Ověření srdíček“.
  - U nesouladu v Pořadí i v Hodnocení je „⚔ Ověřit porovnáním“. Spustí čtyři taková porovnání hned za sebou s ukazatelem postupu.
  - Na konci pruh řekne, jestli porovnání nesoulad potvrdila („patří jí spíš 3½ ♥ místo 3 ♥“ s tlačítkem „Dát jí 3½ ♥“), nebo ne („3 ♥ jí sedí“).

## [0.99.57] – 2026-10-27

### Změněno
- **Rychlé hodnocení je chytřejší a sjednocené.**
  - **Nově přidané napřed:** nehodnocená modelka přidaná v posledních 14 dnech jde na začátek fronty.
  - **Pořadí podle užitku:** napřed modelky, u kterých tvoje srdíčka pořadí nejvíc změní, tedy vysoký, ale nejistý odhad. Odhad bere i sílu z porovnání a srdíčka fotek, nejen model vkusu.
  - **Nesedí se srdíčky ve frontě:** po nehodnocených přijdou modelky, kterým podle porovnání nesedí srdíčka, se stejným návrhem jako v Pořadí. Enter dá návrh, N srdíčka nechá. V Pořadí je odkaz „Projít v Hodnocení →“.
  - **Paměť přeskočených:** přeskočené modelky jdou na konec fronty i příště, ohodnocením z paměti zmizí.
  - **Ochrana před ukotvením:** nejistý odhad se ukáže až po chvíli (nebo po „Ukázat odhad“), aby nejdřív rozhodly fotky. Srdíčka daná Enterem z odhadu si program pamatuje jako převzatá a model vkusu se z nich neučí, dokud je nepotvrdí porovnání.
- **Model vkusu se učí i z porovnání:** nehodnocená modelka, která má za sebou aspoň tři porovnání a jistou sílu, mu slouží jako další příklad. Odhady se tak zlepšují i z porovnávání.

## [0.99.56] – 2026-10-27

### Přidáno
- **Rychlé hodnocení:** nová část Oblíbenosti „Hodnocení“ vedle Porovnávání. Ukazuje nehodnocené modelky jednu po druhé, vlevo velkou titulní fotku a vpravo pás jejích nejlepších fotek. Pod tím je odhad srdíček podle tvého vkusu i s důvodem.
  - **Klávesy:** Enter odhad přijme, 1–5 dá srdíčka (i na české klávesnici bez Shiftu), půlky jdou klikem na srdíčka. S přeskočí, Backspace vrátí poslední.
  - **Pořadí fronty:** napřed modelky, které by se ti podle odhadu mohly líbit nejvíc, pak ostatní. Po každých pěti hodnoceních se odhady zpřesní.
  - Odkaz „Ohodnotit rychle →“ je i u „Mohlo by se ti líbit“ v Pořadí.

## [0.99.55] – 2026-10-27

### Změněno
- **Rozhodnout teď je hned za štítkem pod jménem.** Růžový odkaz „⚔ Rozhodnout teď“ stojí na stejném řádku jako „⏳ čeká na Top 10 …“ nebo „🛡 obhajuje Top 10“, tedy u toho, co modelce chybí. Pruh síly vpravo zůstává volný a podbarvení čekající modelky zabírá celý její řádek.

## [0.99.54] – 2026-10-27

### Přidáno
- **Rozhodnout teď:** u čekající nebo obhajující modelky v Pořadí je tlačítko „⚔ Rozhodnout teď“.
  - Spustí hned za sebou jen ty souboje, které jí chybí: tolik, kolik jí chybí porovnání (2–6), proti posledním potvrzeným v úrovni. U obhajoby je to jediný souboj držitelky s vyzyvatelkou.
  - Nad pásy je pruh s ukazatelem postupu („souboj 2 ze 4“). Přeskočit a Vrátit fungují, Ukončit vrátí běžný mix.
  - Po posledním souboji se pořadí přepočte a pruh řekne, jak to dopadlo: postoupila, zatím nepostoupila (a co chybí), obhájila, nebo vypadla.

## [0.99.53] – 2026-10-27

### Změněno
- **Síň slávy: legendy vyplní celou šířku.** Nejvýš 7 v řadě, řady se plní rovnoměrně (8 legend → 4 + 4, 10 → 5 + 5), takže vpravo nezůstávají prázdná místa. Malé písmo jmen mají jen husté řady od šesti karet.

## [0.99.52] – 2026-10-27

### Změněno
- **Síň slávy: místa 4–10 v jedné řadě.** Sedm karet pod stupni vítězů se poměrně zmenší a vyplní celou šířku, vpravo nezůstane prázdné místo. V úzkém okně jdou po čtyřech.

## [0.99.51] – 2026-10-27

### Změněno
- **Profil modelky ukazuje pod srdíčky jen aktuální pořadí** („1. v oblíbenosti“, klik otevře Pořadí). Úroveň Top N, čekání, obhajoba, trend a řádek síně slávy z profilu zmizely; najdeš je v Oblíbenosti (Pořadí a Síň slávy).

## [0.99.50] – 2026-10-27

### Změněno
- **Síň slávy: stupně vítězů.** První tři modelky Top 10 mají větší portréty na stupních: 2. vlevo, 1. uprostřed a nejvýš, 3. vpravo. Každá stojí na podstavci s číslem místa, jednička v růžové, dvojka stříbrná, trojka bronzová. Od 4. místa zůstává běžná mřížka karet.

## [0.99.49] – 2026-10-27

### Přidáno
- **Síň slávy:** třetí část Oblíbenosti vedle Porovnávání a Pořadí.
  - **Top 10 jako karty modelek** jako v galerii. Vpravo nahoře je místo (jednička s korunkou), pod jménem jak dlouho v Top 10 je, kolikrát obhájila (🛡) a kolikátý je to pobyt. Podrobnosti ukáže bublina.
  - **Rekordy jako zlaté štítky 🏆 na kartě:** nejdéle v Top 10, nejdelší vláda na 1. místě, nejvíc obhajob, nejrychlejší postup a největší návrat.
  - **Legendy:** bývalé Top 10 jako vybledlé karty s nejlepším místem.
  - **Kronika** je jeden řádek s nejnovější událostí, po rozkliknutí celá po měsících. Obsahuje vstupy, výpadky (i kdo modelku vytlačila), obhajoby a nové jedničky.
  - **Profil** modelky, která v Top 10 je nebo byla, má řádek „🏆 V Top 10 87 dní · na 1. místě 12 dní · 2× obhájila · nejlépe 1.“, klik otevře Síň slávy.
  - Kronika se ukládá trvale a začíná touto verzí; kdo už v Top 10 je, má „aspoň“ dní od jejího začátku. Vrácení porovnání vrátí i kroniku.

## [0.99.48] – 2026-10-27

### Přidáno
- **Obhajoba místa v Top 10, 20 a 50: sestup je stejně těžký jako postup.**
  - Potvrzená modelka o místo nepřijde jen proto, že ji silou předstihla jiná. Drží ho, dokud s ní vyzyvatelka neprohraje ve vzájemném souboji; remíza se nepočítá.
  - Bez souboje místo ztratí, jen když přestane splňovat prahy úrovně nebo silou klesne pod dvojnásobek hranice (u Top 10 pod 20. místo).
  - Porovnávání nabízí souboj o obhajobu přednostně, se štítkem „Obhajoba Top 10“. Po souboji přijde upozornění „Bára obhájila Top 10“ nebo „… prohrála souboj a vypadla z Top 10“.
  - Pořadí ukazuje „🛡 obhajuje Top 10“ a „⚔ čeká na souboj o Top 10 (místo brání …)“, profil „Top 10 · 🛡 obhajuje“.
  - Vrácení porovnání vrátí i obhajobu.
  - V simulaci vypadávají z potvrzené Top 10 modelky, které tam skutečně patří, o třetinu méně a přesnost pořadí se nezhorší.

## [0.99.47] – 2026-10-27

### Přidáno
- **Úrovně Top 10 / 20 / 50 / 100 s těžším vstupem:** do vyšší úrovně se modelka dostane, až má dost porovnání a jistotu.
  - Prahy:
    - Top 10: 10 porovnání, nejistota nejvýš 0,3 a výhra nad některou z potvrzené Top 20.
    - Top 20: 6 porovnání.
    - Top 50: 4 porovnání.
    - Top 100: 2 porovnání; samotný odhad se sem nedostane nikdy.
  - Kdo podle síly patří výš, ale prahy ještě nesplňuje, čeká těsně pod hranicí. Do Top N se navíc potvrdí jen modelka, která je podle síly nejvýš na místě 2·N.
  - Číslo oblíbenosti se nemění, mění se jen potvrzené pořadí.
- **Souboje na hranicích úrovní:** Porovnávání do mixu zařazuje dvojice čekající modelky proti posledním potvrzeným v úrovni a souboje sousedek o 10., 20., 50. a 100. místo. Nad pásy mají štítek „⚔ Souboj o Top 10“ nebo „O postup do Top 10“. Po souboji se pořadí hned přepočítá, postup do vyšší úrovně ohlásí upozornění.
- **Úrovně v rozhraní:**
  - Pořadí: oddělovače úseků s počtem potvrzených, u čekajících „⏳ čeká na Top 10 (6 z 10 porovnání…)“ s místem podle síly a pravidla úrovní pod seznamem.
  - Profil ukazuje „· Top 10“ nebo čekání, karty modelek odznak TOP 10.
  - Přehled ukazuje v Top 10 jen potvrzené a počet čekajících s odkazem do Porovnávání.

### Změněno
- **Trend a šipky** sledují potvrzené pořadí, takže postup do Top 10 se ukáže jako vzestup. Starší denní snímky se dál porovnávají podle oblíbenosti.
- **Přesnost pořadí:** v simulaci se 400 modelkami odpovídá po 800 porovnáních prvních 10 míst skutečné Top 10 ze 74 % místo 66 %.

## [0.99.46] – 2026-10-27

### Změněno
- **Přepínání stránek pod hledáním jako přepínač, ne rozbalovací seznam:** všechny možnosti jsou vedle sebe a zvolená je zvýrazněná, klik přepne rovnou. Platí pro Oblíbenost (Porovnávání / Pořadí), Přehled sbírky (Přehled / Údržba / Sháním CZ / Statistiky, s počty) i Čísla (Obálky / Kalendář). V úzkém okně zůstanou jen ikony.

## [0.99.45] – 2026-10-27

### Změněno
- **Rychlejší pásy fotek v porovnání:** fotky se stahují postupně, až se v pásu přiblíží (místo všech 48 najednou zhruba 10 na pás, další při rolování), a ve velikosti podle výšky pásu (na běžném monitoru w400 místo w600). Další dvojice přednačte jen fotky, které budou hned vidět. Změna srdíček fotky přepíše jen její štítek (dřív se pás sestavoval znovu), pohyb myši mění zvýraznění jen u dvou fotek a neaktivní pás ztlumí lehký překryv místo průhlednosti celého pásu; tlačítko „♥ Tahle“ už nemá náročné rozmazané pozadí.

## [0.99.44] – 2026-10-27

### Změněno
- **Model vkusu („Mohlo by se ti líbit“, štítek „odhad“) bere i poměr hrudník/pas a věk při prvním vydání** (z data narození). Na zkušebních sbírkách, kde na nich vkus závisí, odhad zpřesnily (3000 modelek: Spearman 0,407 → 0,425, odhad u 76 % místo 66 % nehodnocených); kde ne, nic nemění. S malým počtem hodnocených škodily, proto se použijí až od 60 hodnocených modelek s tím údajem. Důvod odhadu je může uvést („věk 21 let“, „poměr hrudník/pas 1,52“).

## [0.99.43] – 2026-10-27

### Změněno
- **Oblíbenost sjednocená do jednoho modelu:** nehodnocená modelka má teď předpoklad síly z odhadu podle vkusu (s jeho nejistotou), jinak ze srdíček fotek – stejné číslo ukazuje štítek „odhad“, řadí galerii, určuje soupeřku v porovnání i návrh srdíček. Dřív se pro soupeřku bral odhad vkusu, ale pořadí a návrh vycházely z průměru sbírky nebo fotek. V Pořadí jsou proto i nehodnocené s odhadem podle vkusu (označené „odhad“).
- **Návrhy srdíček jen z jednoho místa:** po porovnání se už nenabízí skok o celé srdíčko po jediné volbě (pravidlo v rozhraní, které odporovalo „Nesedí se srdíčky“). Pod pásy se ukáže tentýž návrh jako v Pořadí – nehodnocené po pár porovnáních, hodnocené při nesouladu – se stejnou větou, „Dát jí“ i „Nechat“; „Nechat“ platí na obou místech.
- Věta o modelu vkusu počítá skutečně hodnocené modelky (dřív i odhadnuté v pořadí).
- Kód oblíbenosti rozdělený podle témat (výběr dvojic, návrhy srdíček) beze změny chování.

## [0.99.42] – 2026-10-27

### Přidáno
- **„Nesedí se srdíčky“ i podle srdíček fotek:** modelka, jejíž hodnocené fotky (aspoň 2 alba a 10 fotek) vycházejí aspoň o celé srdíčko jinde než její srdíčka, dostane návrh o půl srdíčka směrem k fotkám („Cecílie (2 ♥) má fotky za 4,6 (4 alba, 37 hodnocených) – možná jí patří 2½ ♥“). Když stejným směrem ukazují i porovnání, je to jedna položka a jde napřed; když proti sobě, platí porovnání. Ukáže se prvních 8, ostatní pod „Zobrazit všech“.
- V pásu porovnání je u jména **skóre fotek** („fotky 4,3“, v bublině z kolika alb a fotek).

## [0.99.41] – 2026-10-27

### Změněno
- **Porovnávání bez přepínání dvojic:** volba Stejné srdíčko / Všechny / I nehodnocené zmizela, program míchá dvojice sám – hlavně stejné a sousední úrovně, asi třetinu nehodnocených proti modelce s tolika srdíčky, kolik ukazuje jejich odhad (přednost mají rozpracované, aby se dotáhly k návrhu srdíček), a častěji modelky, kterým nesedí srdíčka.

### Přidáno
- **„Nesedí se srdíčky“ v Pořadí:** modelka s víc srdíčky, která v porovnáních soustavně prohrává se slabšími („Eva (4½ ♥) prohrála 3 ze 4 porovnání s modelkami s méně srdíčky – možná jí patří 4 ♥“), nebo naopak slabší vyhrávající se silnějšími, s tlačítky „Dát jí 4 ♥“ a „Nechat“. V Porovnávání je odkaz s počtem. Počítá se proti tomu, co by čekala samotná srdíčka, a až od tří takových porovnání.

## [0.99.40] – 2026-10-27

### Přidáno
- **Návrh srdíček pro nehodnocenou modelku z porovnání:** po aspoň třech porovnáních, když už je jasné, kam patří, se pod pásy nabídne „Nehodnocená Anna vychází po 4 porovnáních (výhry 2,5) na 3½ ♥ – Dát jí 3½ ♥ / Nechat“. Samé výhry nebo prohry nad jednou úrovní návrh nedají (ví se jen „výš“, ne o kolik) – nejdřív přijde soupeřka o úroveň dál. „Nechat“ návrh pro tu modelku do zavření programu nenabízí.

## [0.99.39] – 2026-10-27

### Změněno
- **Nehodnocené modelky (Dvojice: I nehodnocené) se porovnávají s modelkou, která má přesně tolik srdíček, kolik ukazuje jejich odhad** (odhad vkusu, jinak podle srdíček fotek, jinak průměr sbírky). Výhra posune další soupeřku o úroveň výš, prohra níž, takže pár porovnání najde, kam modelka patří. Když nikdo s takovým počtem srdíček není, vybere se nejbližší úroveň. Pod pásy je důvod, např. „Odhad podle vkusu: 3½ srdíčka – proti modelce s 3½ srdíčka: vyhraje-li, patří výš, prohraje-li, níž“.

## [0.99.38] – 2026-10-27

### Opraveno
- **Fotka z pásu v porovnání se otevírá v běžném prohlížeči fotek** (stejném jako u alb: lupa, otáčení, lišta alb, srdíčka, slideshow) na té fotce mezi všemi fotkami modelky; po zavření se vrátíš k porovnání a pás té modelky ukáže nová srdíčka fotek. Dosavadní jednoduché zvětšení zmizelo.

## [0.99.37] – 2026-10-27

### Změněno
- **Pás fotek v porovnání má vlevo titulní fotku** se jménem (otevře profil), srdíčky modelky (jdou rovnou měnit), počtem fotek a tlačítkem „♥ Tahle“; pás fotek pokračuje hned vedle.
- **Pořadí a Mohlo by se ti líbit jsou zase jedna část** (vedle sebe); Oblíbenost má pod hledáním jen Porovnávání a Pořadí.

## [0.99.36] – 2026-10-27

### Změněno
- **Porovnávání bez titulních fotek – rovnou dva pásy fotek nad sebou:** nahoře nejlepší fotky jedné modelky, dole druhé, přes výšku okna. Pás pod myší je aktivní (Tab přepne): kolečko nebo ← → jím listují, klik fotku zvětší, 1–5 jí dá srdíčka, „♥ Tahle“ nebo Enter vybere modelku, ↓ nebo mezerník = stejně. Samostatné okno „Fotky obou“ už není potřeba.
- **Oblíbenost má části pod hledáním** jako Přehled: Porovnávání, Pořadí a Mohlo by se ti líbit (každá přes celou stránku); u Porovnávání je tam i volba Dvojice (Stejné srdíčko, Všechny, I nehodnocené). Pořadí v profilu modelky otevře rovnou část Pořadí.

## [0.99.35] – 2026-10-27

### Změněno
- **Porovnávání v Oblíbenosti podle titulních fotek, fotky obou modelek naráz po kliku:** pás malých náhledů pod fotkou zmizel. Klik na titulní fotku (nebo klávesa F) otevře přes celé okno dvě nezávislé galerie nad sebou – nahoře fotky levé modelky, dole pravé, každá až 24 nejlepších fotek (nejlepší z každého alba napřed). Každá se listuje zvlášť kolečkem nebo šipkami v polovině pod myší (Tab přepne), klik fotku zvětší, 1–5 jí dá srdíčka. Vybrat jde rovnou v galerii („♥ Tahle“ nebo Enter, ↓ = stejně), Esc vrátí k porovnání. Na titulní fotce je počet fotek modelky.

## [0.99.34] – 2026-10-26

### Přidáno
- **Oblíbenost se učí průběžně z toho, co v aplikaci děláš:** otevření profilu modelky a čas prohlížení jejích fotek v prohlížeči posouvají modelku v pořadí uvnitř jejích srdíček. Čerstvý zájem váží víc (poloviční váha po dvou měsících). Kolik zájem váží, se program učí z tvých porovnání modelek se stejnými srdíčky (výchozí malá váha, srdíčka nikdy nepřebije). Ukládá se jen do `playboy-uceni.db` (úprava č. 3 databáze učení), nic neopouští počítač.
- **Vývoj v čase:** program si každý den pamatuje pořadí oblíbenosti. V profilu je pod srdíčky „12. v oblíbenosti · ▲ 3 za 30 dní“ (klik otevře Oblíbenost), na kartě modelky malá šipka při výrazném posunu, v Oblíbenosti u každé modelky posun a řádek „Stoupají / Klesají“. Trend se ukáže po týdnu.
- **Úvod Přehledu má kartu Oblíbenost:** Top 10, Stoupají a Dlouho jsi neviděl (oblíbené, jejichž profil jsi měsíc neotevřel; ukáže se po měsíci sledování).
- **Sháním CZ: „Nejdřív sháněj“** – sháněná čísla s tvými nejoblíbenějšími modelkami napřed.

### Změněno
- Nejlepší fotky a stěna centerfoldů Podle srdíček řadí fotky se stejnými srdíčky podle oblíbenosti modelky.
- Údržba: priorita počítá s oblíbeností modelky (údaje oblíbených se doplňují dřív) a fronta má řazení „oblíbené napřed“.
- „Zapomenout porovnání“ maže i zájem a historii oblíbenosti.

## [0.99.33] – 2026-10-26

### Změněno
- **Filtr srdíček na kartách modelek (♥ 3+, ♥ 4+ …) řadí podle oblíbenosti:** zapnutí filtru samo přepne řazení na „Podle srdíček“ (nejvíc srdíček nahoře, se stejnými srdíčky podle oblíbenosti), vypnutí vrátí řazení, které bylo předtím. Když během filtru zvolíš jiné řazení, zůstane.

## [0.99.32] – 2026-10-26

### Změněno
- **Řazení galerie „Podle srdíček“ řadí modelky se stejnými srdíčky podle oblíbenosti** (porovnávání a skóre fotek), takže i s filtrem ♥ 4+ vidíš skutečné pořadí místo náhodného. Nehodnocené modelky jsou na konci seřazené podle odhadu z fotek. Samostatné řazení „Podle oblíbenosti“ je díky tomu zbytečné a zmizelo (kdo ho měl zvolené, má teď „Podle srdíček“); dřív navíc míchalo nehodnocené modelky mezi hodnocené a trhalo lištu srdíček.

## [0.99.31] – 2026-10-26

### Změněno
- **Přesnější odhad oblíbenosti u nehodnocených modelek (model vkusu):** kombinuje regresi s rozhodovacími stromy, takže zachytí i nelineární vkus (např. „líbí se mi jen určitá kombinace údajů“). Štítek „odhad“ se ukáže jen tam, kde odhad na ověření prokazatelně překoná prostý průměr; na umělých sbírkách je chyba ukázaných odhadů zhruba o 10 % menší a pořadí „Mohlo by se ti líbit“ sedí lépe.
- Najetí myší na štítek „odhad“ v galerii ukáže **důvod**: které údaje odhad nejvíc zvedly nebo snížily a které hodnocené modelky jsou nejpodobnější.

## [0.99.30] – 2026-10-26

### Změněno
- Oblíbenost má vlastní tlačítko: **graf** vpravo v liště otevře rovnou porovnávání a pořadí modelek (bez volby pod hledáním). Hned vedle je nové tlačítko **Přehled sbírky** (deska se seznamem) pro Přehled, Údržbu, Sháním CZ a Statistiky – otevře naposledy zvolenou z nich a přepínají se volbou pod hledáním. V liště svítí tlačítko otevřené části.

## [0.99.29] – 2026-10-26

### Přidáno
- V Oblíbenosti → Pořadí jsou i **nehodnocené modelky s hodnocenými fotkami**: zařadí je odhad ze skóre jejich fotek, v seznamu jsou tlumeně se štítkem „odhad z fotek“ (důvod v bublině), dokud je neohodnotíš nebo neporovnáš. Stejný odhad používá i řazení galerie podle oblíbenosti. Pořadí se ukáže už ze srdíček a fotek, bez nutnosti porovnávat.

## [0.99.28] – 2026-10-26

### Změněno
- **Porovnávání v Oblíbenosti s náhledem galerie:** pod velkou fotkou každé modelky je řada náhledů z jejích alb (nejlepší fotka z každého alba, pak podle srdíček). Najetí myší ukáže náhled velký na své straně, klávesy 1–8 ukážou n-tou nejlepší fotku na obou stranách najednou, ↑ listuje, 0 vrátí titulní fotky; klik otevře prohlížeč na té fotce a po zavření se vrátíš k porovnání.
- **Spravedlivější pořadí – počítá i se srdíčky fotek v albech:** každé album je jeden hlas (víc fotek nepřeváží), hodnotu alba dávají jeho nejlepší fotky (slabší fotky navíc album nezhorší) a málo hodnocených fotek se stahuje k průměru sbírky (jedna fotka za 5 srdíček ≠ jistých 5). Kolik váží fotky proti srdíčkům modelky, se program učí z tvých porovnání modelek se stejnými srdíčky (výchozí 0,3, nejvýš 0,8). Srdíčka modelky jsou teď měkký předpoklad: fotky a porovnání můžou pořadí posunout o půl srdíčka, o celé nikdy.
- V Pořadí je u modelky rozpad: srdíčka, skóre fotek (počet alb a hodnocených fotek) a porovnání, s důvodem, a věta, kolik fotky právě váží.

## [0.99.27] – 2026-10-25

### Změněno
- **Rychlejší backend:** sbírka se načte jedním průchodem a pamatuje se, dokud se databáze nezmění (Přehled, Údržba, návrhy, učení, oblíbenost i statistiky ji sdílejí místo opakovaného načítání). Na sbírce 3000 modelek: seznam modelek 163 → 2 ms, hledání ~180 → 6 ms, Přehled 283 → 8 ms, návrhy 237 → 5 ms; po změně dat zhruba o polovinu rychlejší. Export 2× a import 2,5× rychlejší, vložení 200 odkazů 5× rychlejší; méně paměti.
- **Rychlejší rozhraní:** skryté přehledy (galerie, čísla, nejlepší) po odchodu uvolní paměť, galerie má jednu obsluhu kliků místo tisíců, profil neměří stránku opakovaně, klávesy nehledají v celé stránce. Na sbírce 3000 modelek (zpomalený procesor): otevření okna modelky −86 %, rolování profilu −81 %, prohlížeč fotek −65 %, přepnutí na Nejlepší −73 %, Údržba −69 %. Editor textu (CodeMirror) a historie změn se načítají až při použití – hlavní skript je o polovinu menší, start rychlejší.
- Úklid nepoužívaného a zdvojeného kódu v backendu i rozhraní.

## [0.99.26] – 2026-10-25

### Přidáno
- **Hodnocení modelek po půlsrdíčkách** (0–5 po 0,5): klik na levou půlku srdíčka dá půlku, na pravou celé; klávesy 1–5 celá srdíčka, stejná číslice znovu přidá půlku, 0 zruší. Na kartách, v profilu, v Údržbě i v okně Doplnit modelku; hodnoty s čárkou („3,5“). Hledání `hodnoceni:3,5`, `>=3,5`. Srdíčka fotek zůstávají celá.
- **Porovnávání dvojic** v nové části Přehledu **Oblíbenost**: dvě velké fotky, ←/→ vybereš, která se ti líbí víc, ↓ nebo mezerník remíza, S přeskočí, Backspace vrátí. Program vybírá dvojice, u kterých si je pořadím nejméně jistý (hlavně ve stejném srdíčku). Pořadí se počítá modelem Bradley–Terry ze srdíček a porovnání; když volba hodně odporuje srdíčkům, nabídne úpravu hodnocení.
- **Model vkusu** (strojové učení z tvé sbírky): odhadne hodnocení nehodnocených modelek z jejich údajů a srdíček jejich fotek – jen když na tvé sbírce ověřitelně funguje (křížové ověření). Odhad je vidět jako tlumený štítek „odhad 3½“ s důvodem; část **Mohlo by se ti líbit** ukáže nehodnocené modelky s nejvyšším odhadem (rovnou je jde ohodnotit). Galerie má řazení **Podle oblíbenosti**.
- Porovnání se ukládají do databáze učení; „Zapomenout naučené“ je nemaže (jsou to tvoje výslovné volby), smazání souboru učení ano.

### Změněno
- **Výjimka v betě se změnou schématu:** úprava databáze č. 13 (`modelky.hodnoceni_pul`, polovina srdíčka) a export verze 9 (`hodnoceni: 3.5`). Před úpravou vznikne záloha `*-pred-migraci.db`, stará hodnocení zůstanou stejná; starší program novou databázi otevře jen pro čtení (3½ ukáže jako 3). Import přijme exporty 1–9; hodnocení mimo 0–5 po půlkách odmítne. Ve výčtu hledání znamená `hodnoceni:4,5` nově 4½ (desetinná čárka), „4 nebo 5“ se píše `4..5`.

## [0.99.25] – 2026-10-25

### Změněno
- **Údržba ve třech režimech** místo dlouhého seznamu: nahoře jeden řádek (úplnost sbírky, počty úkolů, kontroly a návrhů) a přepínač **Po údajích / Po modelkách / Souhrn**; program si pamatuje poslední režim.
  - **Po údajích** (výchozí): vlevo chybějící údaje s počty a návrhy, vpravo modelky, kterým vybraný údaj chybí, s polem k vyplnění přímo v řádku (našeptávání ze sbírky, výběry, srdíčka, odkaz na fotku, převody `5'7"`, `115 lbs`, `34B-24-34`). Návrh je předvyplněný i s důvodem. **Enter uloží a skočí na další řádek**, Esc vrátí hodnotu, Delete označí Netýká se (s Vrátit). „Přijmout N návrhů“ a „Netýká se všem…“ pro celý údaj.
  - **Po modelkách**: karta jedné modelky se všemi úkoly (dřívější soustředěný režim, teď bez mezikroku), vpravo fronta s jedním výběrem filtru; Enter další pole, Ctrl+Enter uloží a otevře další modelku, srdíčka klávesami 1–5.
  - **Souhrn**: oba panely (úplnost, Co se program naučil) a celý seznam s bočními filtry a Vyřízenými.
- Řádky „Co zbývá doplnit“ na úvodu Přehledu otevřou Po údajích rovnou na daném údaji.

## [0.99.24] – 2026-10-25

### Změněno
- Části Přehledu (Přehled, Údržba, Sháním CZ, Statistiky) se už nevybírají z nabídky u tlačítka s grafem: tlačítko rovnou otevře Přehled na naposledy zvolené části a mezi částmi se přepíná volbou s ikonou pod hledáním – stejně jako Obálky / Kalendář u Čísel. U Údržby je v nabídce počet úkolů.

## [0.99.23] – 2026-10-25

### Změněno
- **Údržba pod oběma panely uklizená** (varianta A): vlevo boční panel s filtry po oblastech a počty (Fronta, Modelky, Alba, Čísla, Vyřízené; u Návrhů a Kontroly podseznam zdrojů), vpravo jeden pruh **Další krok** („Přijmout jisté“, „Začít postupně →“) místo karet, pruhu návrhů a lišty s tlačítkem, pod ním jedna lišta s hledáním, řazením a ⋯ Hromadně. Řádky ukazují jen souhrn (nejvýš tři štítky) a jedno hlavní tlačítko, podrobnosti a všechny akce po rozbalení. V úzkém okně se boční panel změní na výběr v liště.

### Přidáno
- **Soustředěný režim** (varianta C): „Začít postupně“, klávesa S nebo ⋯ „Vyřídit v soustředěném režimu“ otevře velkou kartu jedné modelky se všemi úkoly k vyřízení na místě – chybějící údaje rovnou napíšeš nebo vybereš (i srdíčka a odkaz na titulní fotku), nález kontroly opravíš nebo označíš V pořádku, návrh přijmeš ✓ nebo odmítneš ✕ (úprava hodnoty se zapíše jako oprava pro učení); co na místě nejde (text a vydání alba, cover, centerfold), otevře stávající okno. Vpravo fronta „Na řadě“ podle filtru a řazení. Ctrl+Enter uloží a otevře další, PageUp/PageDown nebo Alt+←/→ předchozí a další, Esc zpět na seznam (s rozepsanými změnami se zeptá „Zahodit změny?“). Ukládá jen změněná pole.

## [0.99.22] – 2026-10-25

### Přidáno
- **Vlastní databáze učení** `playboy-uceni.db` vedle sbírky (sbírka ani export se nemění; když soubor chybí nebo je poškozený, učení začne znovu): deník rozhodnutí (přijato, odmítnuto, opraveno, „V pořádku“, „Znovu kontrolovat“), odmítnutí konkrétní hodnoty místo celého údaje, kalibrace jistoty podle toho, jak často který zdroj trefí (zdroj, který stále odmítáš, sám zmizí), mezipaměť výpočtů. Kontrola zpřísní pravidla, která často označuješ „V pořádku“. Popis v `docs/UCENI.md`.
- Návrhy spojují víc zdrojů (souhlasné zvýší jistotu, odporující se ruší), nový zdroj **podobné modelky** odhadne chybějící míry z nejpodobnějších modelek; u každého návrhu je vidět zdroj.
- V Údržbě panel **Co se program naučil**: úspěšnost zdrojů, počty přijatých / odmítnutých / opravených, „Zapomenout naučené…“ (se zálohou). Úprava návrhu přes „Upravit…“ a uložení jiné hodnoty se zapíše jako oprava.

### Změněno
- **Stránka Údržba přepracovaná:** nahoře úplnost sbírky po oblastech (klik zapne filtr) a „Co doplnit dál“ (čtyři nejcennější úkoly; Playmate bez data narození první), lišta filtrů s počty, hledání jména nebo čísla (Ctrl+F nebo /), řazení, skupiny po modelkách jdou sbalit, jeden vzhled řádku pro úkoly, nálezy Kontroly i návrhy. Klávesy ↑↓ PgUp/PgDn Home/End, →/← rozbalí a sbalí, Enter hlavní akce, Delete odloží, E upraví návrh. Hromadné akce se vždy zeptají a jdou vrátit; jeden přepínač „Vyřízené“ ukáže netýká se, v pořádku i odmítnuté.
- Rychlejší Přehled a Údržba: opakované otevření na velké sbírce asi 3× rychleji, akce v Údržbě už nenačítají celý Přehled znovu.

### Opraveno
- Klik do řádku Údržby otevíral profil; modelka s nálezem kontroly byla ve frontě dvakrát; „Hromadně“ a ⋯ hned zavíraly nabídku.
- Z nezávislé revize (`docs/REVIZE-UDRZBA-UCENI.md`): obnovení ze zálohy se nebere jako oprava nálezů; „V pořádku“ a „Netýká se“ hlásí chybu, když se neuloží; klik během překreslení fronty se neztratí; oprava návrhu se zapisuje správně (i změna jen tvaru zápisu, ne vymazané pole); výpočet návrhů běží jen jednou najednou a další drobnosti.

## [0.99.21] – 2026-10-25

### Opraveno
- Uložení alba (a podobně klik na tag ve formuláři modelky) šlo někdy až na druhý klik: po opuštění pole se znovu přepsal náhled i text tlačítka „Uložit … fotek“ a WebKitGTK první klik zahodil, protože se obsah tlačítka mezi stisknutím a puštěním myši vyměnil. Náhledy a texty se teď přepisují jen při skutečné změně.

## [0.99.20] – 2026-10-25

### Změněno
- Kategorii **Cyber Girl** dává modelce jen album **Cyber Girl of the Week** nebo **of the Month** (Cyber Girl týdne / měsíce). Obyčejné album Pictorial online už Cyber Girl nepřidává; proužek u profilovky pak ukazuje „Online“. Výskyt „jen online“ zůstává.

## [0.99.19] – 2026-10-25

### Přidáno
- **Návrhy doplnění v Údržbě** (strojové učení ze tvé sbírky, nic neodchází z počítače): program navrhne chybějící údaje s jistotou v procentech a důvodem, např. „místo narození Texas → USA (ve sbírce 12 z 12 modelek odtud)“. Zdroje:
  - národnost z místa narození (tabulka zemí, států USA a měst + co je ve sbírce) a podle edice, ve které modelka vyšla;
  - etnicita podle národnosti, barva vlasů a očí podle etnicity a národnosti – jen když je sbírka jednoznačná;
  - obvody a velikost prsou z textu měr (cm i palce), odhad chybějícího obvodu z ostatních měr (vždy jen „odhad“);
  - kategorie Playmate roku z poznámky či tagů (rok musí sedět k centerfoldu);
  - vydání alba z data v názvu nebo z čísla jejího centerfoldu, datum online alba z názvu, fotograf alba podle alba stejného čísla nebo ostatních alb modelky.
  Hodnoty se píšou tak, jak je ve sbírce zapisuješ. Jistota se ověřuje na údajích, které už ve sbírce máš; spory a slabé důkazy se nenabízejí. Odmítnutí program bere jako poučení – podobné návrhy pak nenabízí.
- V Údržbě nová část **Návrhy** (počet i v hlavičce a na úvodu Přehledu): po modelkách a albech, u každého hodnota, jistota (jisté ≥ 90 %, pravděpodobné ≥ 70 %, odhad), důvod a ✓ Přijmout / Upravit… (otevře formulář nebo okno alba s předvyplněnou hodnotou) / ✕ Odmítnout. Hromadně „Přijmout vše jisté“ a „Přijmout vše u modelky“ (jedna transakce, před ní záloha „Před přijetím návrhů“), „zobrazit i odmítnuté“ s Vrátit, Vrátit v oznámení. Klávesy: Enter přijme, Delete odmítne, šipky mezi řádky.
- Odmítnutí se ukládá mezi „netýká se“ (klíče `nv-*`), takže ho nese i export; bez změny databáze.

## [0.99.18] – 2026-10-25

### Změněno
Okna programu sjednocená do vzhledu okna alba (vlevo volby a náhled, vpravo pole), každé s křížkem, Ctrl+Enter a bez vodorovného posouvání v úzkém okně:
- **Formulář modelky:** vlevo části formuláře (klik doroluje, tečka = vyplněno) a náhled „V profilu bude“ s pruhem „Vyplněno X z 18 údajů“; vpravo hustší pole (méně rolování). Živé nápovědy: věk z data narození, chybné datum, americké míry (`5'7"` → 170 cm, `115 lbs` → 52 kg, `34B-24-34`), BMI, upozornění na stejné jméno ve sbírce. Tagy se přidávají a odebírají klikem. Doplnit modelku je širší, převádí míry stejně a má křížek.
- **Okno alba:** vejde se i na nízkou obrazovku (pole se posouvají, tlačítka zůstávají dole), tišší a kratší nápovědy, náhled s obrázkem první vložené fotky a počtem fotek, volby jdou ovládat šipkami.
- **Okno coveru:** náhled obálky z vloženého odkazu s páskou čísla, Měsíční/Speciál jako volby vlevo.
- **Okno čísla:** obálka se štítkem stavu, stav ve sbírce jako volby, u „Na obálce“ hned vidět, jestli se jméno propojí s profilem.
- **Okno článku:** živé záhlaví (rubrika · strana · druh), pole přeskupená, upozornění na neznámou modelku hned při psaní, počet a náhledy skenů.

### Přidáno
- Společný editor textu i pro **poznámku modelky** a **poznámku čísla**. Editor ukazuje, který formát je u kurzoru (opakovaný klik ho vypne), odrážky jako tečky, u článku perex a mluvčí jako ve čtečce, tlačítko **Náhled** (přesně jako v profilu/čtečce), počet slov a znaků; Enter v číslovaném seznamu přečísluje položky.

## [0.99.17] – 2026-10-25

### Změněno
- **Okno alba ve dvou sloupcích** (varianta A): vlevo se volí Kde vyšlo, Druh a u časopisu Číslo (přepínače pod sebou) a pod nimi je náhled „V profilu bude: …“ s názvem a popisem alba, jak se ukáže v profilu. Vpravo jsou jen pole, která zvolený typ potřebuje; týden nebo měsíc Cyber Girl je vidět přímo v poli Nafoceno. Pod odkazy je počet rozpoznaných fotek a tlačítko ukazuje „Uložit 12 fotek“. V úzkém okně jsou sloupce pod sebou.

### Přidáno
- **Společné okno pro psaní textu** – průvodní text alba i text článku. Text je vidět rovnou naformátovaný (tučně, kurzíva, přeškrtnutí, nadpisy, citáty, odrážky, u článku mluvčí „PLAYBOY:“); značky markdownu se objeví, jen když je kurzor v daném místě. Lišta nástrojů, Ctrl+B / Ctrl+I, Enter v odrážkách pokračuje další odrážkou (na prázdné odrážce seznam ukončí), Ctrl+Enter text použije, Esc s rozepsaným textem se zeptá „Zahodit změny?“. V okně alba a článku je místo pole náhled textu; klik na něj otevře editor. Editor stojí na knihovně CodeMirror 6 (nová závislost rozhraní).

## [0.99.16] – 2026-10-25

### Změněno
- **Speciály v okně coveru zvlášť:** stejně jako v okně alba má okno coveru řadu **Číslo** – Měsíční, nebo Speciál s vlastním výběrem speciálů zvoleného roku a edice („Nový speciál…“). Cover speciálu se otevře rovnou s volbou Speciál. Po změně roku nebo edice se vybraný speciál zruší (patří ke konkrétnímu roku).

## [0.99.15] – 2026-10-25

### Změněno
- Výběr měsíce v oknech alba a coveru má u českého názvu anglický v závorce („Červen (June)“).
- **Speciály v okně alba zvlášť:** u Časopisu přibyla řada **Číslo** – Měsíční, nebo Speciál. Výběr měsíce má jen dvanáct měsíců, speciál má vlastní výběr se speciály zvoleného roku a edice a volbou „Nový speciál…“. Album u speciálu se otevře rovnou s volbou Speciál. (Okno coveru má speciály zatím ve výběru měsíce.)

## [0.99.14] – 2026-10-25

### Změněno
- **Výběr typu alba ve dvou krocích:** v okně alba je místo rozbalovacího seznamu nahoře řada **Kde vyšlo** (Časopis / Online / Nikde) a pod ní **Druh** – u časopisu Pictorial nebo Centerfold, u online Pictorial, Cyber Girl of the Week nebo of the Month, „Nikde“ je pictorial bez čísla i data. Okno ukazuje jen pole, která zvolený typ potřebuje (vydání, nebo datum nafocení s týdnem či měsícem). Uložený pictorial bez čísla se otevře jako „Nikde“; starší typy (Cover…) zůstanou jako další druh u časopisu. Pole Fotograf je pod názvem alba.

## [0.99.13] – 2026-10-25

### Přidáno
- **Cyber Girl of the Month:** v okně alba u Pictorial online je místo zaškrtávátka výběr **Cyber Girl**: of the Week (týden z celého data) nebo of the Month (měsíc z data, stačí RRRR-MM). Nadpis alba „Cyber Girl měsíce · červen 2004“, modelka dostane kategorii **Cyber Girl měsíce** (má přednost před týdne). V exportu nová hodnota typu `Cyber Girl měsíce`, bez změny databáze.

## [0.99.12] – 2026-10-24

### Přidáno
- **Cyber Girl of the Week:** v okně alba u typu Pictorial online nová volba „Cyber Girl of the Week“. Program z celého data nafocení (RRRR-MM-DD) spočítá týden v roce podle ISO 8601 a ukáže ho hned v okně; nadpis alba v profilu „Cyber Girl týdne · 24. týden 2004 (nafoceno 12. 6. 2004)“. Modelka dostane odvozenou kategorii **Cyber Girl týdne** (i když má zapsané Online), proužek u profilovky zůstává „Cyber Girl“.
- Album se ukládá jako typ `Cyber Girl týdne` – bez změny databáze; v exportu je to nová hodnota `typ` (starší 0.99.9–0.99.11 ji při importu nepřijme).

## [0.99.11] – 2026-10-24

### Změněno
- Proužek online alb v profilu je sjednocený a bez data: **Cyber Girl**, jinak **Online**. Cyber Girl má přednost před Online (i když má modelka zapsané obojí); Coed, Muse a další online kategorie se zatím ukazují jako Online. Proužek je jen jeden, i když má modelka víc online alb.

## [0.99.10] – 2026-10-24

### Přidáno
- Online album (Pictorial online) dává modelce odvozenou kategorii **Cyber Girl**, stejně jako centerfold dává Playmate měsíce. Když má modelka zapsanou jinou online kategorii (Coed, Muse, Creator…), použije se ta. Funguje ve filtru Kategorie, ve Statistikách i v hledání `kategorie:"cyber girl"`.
- Proužek v rohu fotky v profilu: u online alba „Cyber Girl · Čvn 04“ (datum nafocení, bez data jen kategorie); klik přejde na album.

## [0.99.9] – 2026-10-24

### Přidáno
- Nový typ alba **Pictorial online** pro pictorialy, které vyšly jen na webu (např. Cybergirl). Nemá vydání (měsíc, rok, edici), místo toho volitelné pole **Nafoceno** – datum, kdy bylo album nafoceno. Je to jen informace u alba, na profil modelky (narození, výskyt) se nepřenáší. V profilu se ukáže v nadpisu alba („Pictorial online · nafoceno červen 2004“).
- Modelka s online albem a bez čísla časopisu má výskyt „online“. Hledání `nafoceno:2004` (i `nafoceno:2004-06`, čárka = nebo, `-nafoceno:` vylučuje); ve Statistikách druh výskytu „Online“.
- Online alba nejsou v kalendáři, mezi čísly, na titulní fotce ani v Údržbě mezi „alby bez vydání“.

### Změněno
- **Výjimka v betě:** úprava databáze č. 12 (sloupec `datum` u alb) a export verze 8 (klíč `datum` u alba). Před úpravou vznikne záloha `*-pred-migraci.db`; starší exporty (verze 1–7) se dál načtou. Starší program novou databázi otevře jen pro čtení. Lhůta 14 dní do 1.0.0 běží znovu od této verze.

## [0.99.8] – 2026-10-23

### Opraveno
Další nálezy revize kódu (`docs/REVIZE-GO-DATA.md`, `docs/REVIZE-ROZHRANI.md`):
- Opakovaný import exportu z jiné databáze (nebo ručně psaného souboru) zakládal stejnojmenné modelky znovu; když nejde jednoznačně poznat, která to je, modelka se přeskočí s hláškou.
- Obnovení zálohy, která mezitím zmizela, obnovilo prázdnou sbírku; teď se nic nezmění. Zálohy se otevírají opravdu jen pro čtení.
- Sloučení modelek přenese i články a označení „netýká se“ / „V pořádku“.
- Export, při kterém se nepodaří načíst část dat, skončí chybou místo neúplného souboru.
- Přejmenování fotografa a tagu, úprava coveru a uložení výsledku kontroly souborů proběhnou celé, nebo vůbec; chyba zápisu se ohlásí.
- Vložení samých nefunkčních odkazů už nezaloží prázdné album.
- Zamčený program neukazuje pole hledání; křížky prohlížeče, čtečky, oznámení a zavření programu a pole článku mají popisky pro čtečku; text pod grafem Statistik („tažení myší období“, „nejsou“); fokus z klávesnice je vidět i u vybraného řádku grafu.

## [0.99.7] – 2026-10-23

### Opraveno
- Instalátor: neznámý nebo překlepnutý přepínač (třeba `--odinstaluj`) už program nesestaví a nenainstaluje, ale ohlásí chybu; nový přepínač `--napoveda`. Před sestavením zkontroluje verzi Go a srozumitelně poradí `sudo dnf upgrade golang`. Cesta v položce nabídky je v uvozovkách (domovská složka s mezerou).

### Přidáno
- `./zkontrolovat.sh` spustí všechny kontroly najednou: sestavení rozhraní, testy a typy, gofmt, vet, testy Go, volitelně shellcheck a govulncheck.
- Test verze hlídá i kontrolní součet `package.json.md5` a verzi v `package-lock.json`; nový test porovná vazby rozhraní (`App.js`) s metodami backendu.

### Změněno
- README a ROADMAP sjednocené s pravidlem verzování (bez značek v gitu); návod na testy na čerstvém klonu.

## [0.99.6] – 2026-10-23

### Opraveno
Nálezy revize kódu (zprávy v `docs/REVIZE-*.md`):
- Dotaz „Zahodit změny?“ se u článku, úpravy čísla, Doplnit modelku a rychlé Nové modelky ukazoval pod oknem (chyba z 0.99.4) – teď je navrchu, Esc a Tab patří jemu; po zrušení mazání článku zůstanou rozepsané změny chráněné; po „Uložit a další album“ se Esc zbytečně neptá.
- Doplnit modelku: zvolená srdíčka a titulní fotka jsou rozepsané změny – Esc i tlačítka, která okno opustí, se nejdřív zeptají.
- Hledání `rok:1975-01` a `narozena:1975-03` vracelo všechny modelky do roku 1975 (bralo se jako rozsah 1–1975); teď najde číslo nebo měsíc narození. Ve frontendu totéž pro `vydani:1975-01` v Číslech, Kalendáři, na stěně a v Nejlepších.
- Vložené odkazy smíšené s holými ID souborů: holá ID se tiše ztrácela, teď se vloží všechna.
- Kontrola: datum úmrtí zapsané jen rokem („1980“) se hlásilo jako „před prvním vydáním 1980-08“; data se porovnávají na společnou přesnost.
- Statistiky: návrat Zpět ze seznamu modelek už nezruší výběr; přerušené tažení v grafu výběr nerozbije.
- Zpět na profil smazané nebo sloučené modelky se přeskočí a otevře se předchozí místo.

## [0.99.5] – 2026-10-23

### Změněno
- Pravidlo verzování zapsané v ROADMAP.md (oddíl „Pravidlo verzování“): tvar `x.xx.xx` – MAJOR.MINOR.PATCH bez nul na začátku, MINOR a PATCH 0–99; MAJOR = milník, MINOR = téma z plánu, PATCH = krok nebo oprava; každá změna = nová verze se zápisem v changelogu; značky v gitu se nedělají.
- Test verze hlídá nový tvar a to, že aktuální verze je v changelogu nahoře a vyšší než předchozí.

## [0.99.4] – 2026-10-23

### Opraveno
- Esc, křížek nebo Zrušit u rozepsaného článku, úpravy čísla, Doplnit modelku a rychlé Nové modelky se teď zeptá „Zahodit změny?“ – dřív se text tiše ztratil.
- Album s víc fotografy (oddělenými čárkou, např. „Pompeo Posar, Arny Freytag“) se ukáže na stránce každého z nich; přejmenování fotografa změní jen toho jednoho a nezdvojí jméno, které už v albu je.
- Drobnosti: dvojitá trojtečka u „Přidat fotky nebo album…“, aktuální rada v prázdném čísle („+ Pictorial“), křížky oken mají popisek pro čtečku a bublinu „Zavřít (Esc)“.

### Plán
- Dílčí kroky a rozšíření řady 1.x v `docs/PLAN-1X-DISK.md`, `PLAN-1X-DATA.md`, `PLAN-1X-TEXTY.md`, `PLAN-1X-ROZSIRENI.md`; 1.0.0 nejdřív 6. 11. 2026 (chyby z bety opravené 23. 10.).

## [0.99.3] – 2026-10-23

### Opraveno
- Nepodařené uložení srdíček modelky hlásilo chybu „uložení hodnocení fotky“; teď správně „uložení hodnocení modelky“.

### Plán
- ROADMAP: návrhy strojového učení po 1.0 – 1.16 Kontrola 2.0 (postava podle období, jistota nálezů, učení z oprav), 1.17 Mohlo by se ti líbit (odhad srdíček, doporučení, volitelně malá neuronová síť), 1.18 Postřehy ve Statistikách (trendy, zlomy, výběr proti sbírce); rozbor v `docs/NAVRH-KONTROLA2.md`, `docs/NAVRH-DOPORUCENI.md`, `docs/NAVRH-POSTREHY.md`.

## [0.99.2] – 2026-10-22

### Přidáno
- Kontrola v Údržbě se učí ze sbírky (`kontrola_uceni.go`, bez nových knihoven):
  - Rozsahy výšky, váhy, BMI, obvodů a věku při prvním vydání se odvodí z modelek ve sbírce (robustní medián ± 4,5 σ), když je údajů aspoň 30; u menší sbírky platí pevné hranice. Dolní hranice věku zůstává 18 let.
  - „Neobvyklá kombinace údajů“: modelka, jejíž údaje jsou každý zvlášť v pořádku, ale dohromady ne (Mahalanobisova vzdálenost od středu sbírky); nález řekne, který údaj a jaká hodnota by byla obvyklá.
  - „Podobné jméno“: skoro stejná jména dvou modelek (překlep, prohozené jméno a příjmení, pseudonym), podpořená stejným datem narození nebo prvním vydáním; jiný rok narození shodu vyloučí.
  - Učení z „V pořádku“: tři a více potvrzených hodnot za hranicí, které na ni navazují, hranici posunou (potvrzené šestnáctileté playmate → věk 16 se už nehlásí); podobné potvrzené kombinace se přestanou hlásit.
- Kontrola sbírky s 5 000 modelkami trvá zhruba 80 ms.

## [0.99.1] – 2026-10-22

### Změněno
- Části Přehledu (Přehled, Údržba, Sháním CZ, Statistiky) jsou v kontextové nabídce tlačítka Přehled vpravo v liště (ikona grafu); tlačítko samo zůstává stejné. Volba otevře Přehled rovnou na té části, v otevřeném Přehledu jen přepne část (✓ u zvolené, u Údržby a Sháním CZ počet). Volba části v liště pod hledáním z 0.99.0 odpadla.

## [0.99.0] – 2026-10-22

### Změněno
- Přehled: části Přehled, Údržba, Sháním CZ a Statistiky už nejsou velká lišta přes celou šířku, ale rozbalovací volba v horní liště – stejně jako zobrazení Čísel (Obálky / Kalendář). Tlačítko ukazuje ikonu a název zvolené části, nabídka i počet úkolů Údržby a čísel Sháním CZ. Obsah tak začíná hned nahoře.

### Opraveno
- Statistiky: osa grafů počtů má jen celá čísla (při malých počtech ukazovala 0,2, 0,4…).

## [0.98.0] – 2026-10-22

### Změněno
- Statistiky už se neomezují na modelky s centerfoldem. Grafy v čase počítají každou modelku jednou, v roce jejího prvního výskytu v časopise – centerfold, obálka nebo pictorial u čísla. Přepínač Vše / Centerfold / Obálka / Pictorial vybere, který výskyt se počítá (Centerfold odpovídá dřívějším grafům). „Centerfoldy podle roku“ jsou teď „Modelky podle roku“, věk je „Věk při prvním výskytu“.
- Výběr roku je „první výskyt 1992–2003“ (nebo „první centerfold…“) a platí pro edici a druh výskytu, ve kterých vznikl.
- Nápověda pod grafem řekne, kolik modelek bez čísla (jen online nebo bez vydání) v grafech v čase není; grafy rozložení počítají se všemi modelkami.

## [0.97.0] – 2026-10-22

### Přidáno
- Údržba → Kontrola má vlastní soubor `kontrola.go` a víc pravidel: narození v budoucnosti, před rokem 1900 nebo po prvním vydání; úmrtí před narozením nebo před prvním vydáním; věk při prvním vydání mimo 18–45 let; výška, váha, BMI a obvody mimo běžné rozsahy, pas širší než boky nebo hrudník; Playmate roku dřív než první centerfold (nebo bez něj); dvě různá centerfoldová alba v jednom čísle; stejná fotka ve dvou albech modelky.
- „V pořádku“ (pod ⋯ nebo pravým tlačítkem na štítku): pravdivý údaj, který jen vypadá jako chyba (modelce opravdu bylo 16 let), se už nehlásí. Ukládá se mezi „netýká se“ modelky nebo alba, takže ho nese i záloha a export; „zobrazit i netýká se“ nález ukáže s ✓ a „Znovu kontrolovat“ ho vrátí.
- Štítek nálezu otevře formulář modelky přímo na záložce a poli s údajem (věk → datum narození, výška…); alba a fotky v profilu. Víc nálezů jedné modelky je na jednom řádku.

### Změněno
- Album s jednou fotkou se hlásí, jen když se jeho název podobá jinému albu modelky (překlep při přidávání); samostatné album s jednou fotkou je v pořádku.

## [0.96.0] – 2026-10-22

### Přidáno
- Statistiky: výběr platí pro všechny grafy. Vybraný rok či období (centerfold, přidání) nebo hodnota (kategorie, národnost…) zúží ostatní grafy – jasně modelky výběru, tlumeně celá sbírka a čárkovaně její křivka. Podmínky jsou štítky pod lištou (křížek odebere jednu, „Zrušit výběr“ nebo Esc všechny); grafy s osou roků sdílejí výběr roku centerfoldu.
- Nové grafy v čase: BMI a poměr pas : boky (medián a pásmo) a podíly – blond vlasy, silikonová prsa, oholené ochlupení, tetování a piercing (procento ze známých hodnot s křivkou).
- Souhrn nad grafem srovná výběr s celkem (např. „medián ve výběru 22 let (celkem 21 let)“); pruhy rozložení ukazují „výběr / celkem“.

## [0.95.0] – 2026-10-22

### Změněno
- Přehled → Statistiky jsou přehlednější: místo deseti grafů a řádku čísel je vidět jeden velký graf, vybraný z rozvinutého seznamu, a vedle něj seznam modelek. Vybraný graf si program pamatuje.
- Grafy v čase podle roku centerfoldu: počet centerfoldů (sloupce) a věk v době centerfoldu, výška, váha, hrudník, pas a boky (medián roku a pásmo prostřední poloviny modelek); přes ně bílá křivka klouzavého průměru. Přibývání sbírky po měsících za dva roky. Přepínač Vše / US / CZ.
- Klik na sloupec vybere rok, tažení myší celé období; šipky ← → výběr posouvají, se Shiftem ho rozšíří, Esc ho zruší. Seznam vpravo ukáže modelky vybraného roku nebo období (bez výběru všechny), klik otevře profil.
- Grafy rozložení (kategorie, národnosti, barva vlasů a očí, hodnocení, výskyt, fotografové) jsou pruhy; klik vybere hodnotu, „Otevřít v galerii“ ji převede na hledání.
- Tabulka Vývoj v čase odpadla – její údaje jsou teď grafy v seznamu.

## [0.94.4] – 2026-10-22

### Opraveno
- Kalendář: listování obsahem čísla na kartě už nebliká ani s grafickou akcelerací. Obrázky se střídají okamžitě, bez prolínání – průhlednostní animace nad zaoblenou kartou s posunem při najetí ve WebKitGTK blikala.

## [0.94.3] – 2026-10-22

### Opraveno
- Kalendář: listování obsahem čísla na kartě už nepoblikává. Obrázky leží po celou dobu ve vlastní vrstvě nad obálkou, která nepřijímá myš; střídání je jen zvedne navrch a prolne, nic se pod kurzorem nevkládá ani neodebírá, takže karta neztrácí najetí (posun a růžový rámeček).

## [0.94.2] – 2026-10-22

### Opraveno
- **Kalendář, listování na kartě:** když se obrázky z Disku stahovaly déle než interval střídání (typicky napoprvé), karta přeskakovala na zastaralé snímky, linka neodpovídala obrázku a obálka problikávala. Teď se každý obrázek čísla stáhne jednou a jen se prolne přes obálku; další krok začne, až je předchozí opravdu vidět, a linka se přepne zároveň s obrázkem. Původní obálka zůstává pod překryvy, odjetí myší je jen odebere.

## [0.94.1] – 2026-10-22

### Vylepšeno
- **Kalendář: listování obsahem čísla na kartě.** Když myš chvíli (půl vteřiny) zůstane na kartě čísla, střídá se na ní cover, centerfold a nejlépe hodnocená fotka z pictorialu (asi po 1,2 s, s prolnutím); bílá linka dole ukazuje, co je právě vidět. Odjetí myší vrátí původní obálku. Obsah čísla se načte až při prvním najetí a pak se pamatuje.

## [0.94.0] – 2026-10-22

### Změněno
- **Čísla a Kalendář jsou jedna část:** Čísla mají dvě zobrazení, mezi kterými se přepíná volbou **Obálky ▾ / Kalendář ▾** na začátku lišty voleb (vedle Edice a Filtrů). Obálky ukazují čísla ve sbírce jako velké dlaždice, Kalendář všechny měsíce včetně chybějících. Přepnutím zůstaneš na stejném roce, záložka Čísla svítí v obou zobrazeních a otevře naposledy zvolené. Ikona kalendáře v horní liště odpadla.

## [0.93.0] – 2026-10-22

### Přidáno
- **Výskyt modelky: v časopise, nebo jen online.** Program ho pozná sám: *v časopise* je modelka s centerfoldem, obálkou nebo albem u konkrétního čísla (měsíc nebo speciál; ročník bez měsíce jako „Cybergirl of the Year 2012“ se nepočítá), *jen online* modelka bez čísla s online kategorií (Cyber Girl, Coed, Muse, Creator), ostatní jsou *neurčené*. Výskyt je v profilu, ve Filtrech galerie (s počty), ve Statistikách (skupina Sbírka, kombinuje se s ostatními podmínkami) a v hledání `vyskyt:casopis`, `vyskyt:online`, `vyskyt:neurceno`.
- Nová kategorie **Online** pro modelky jen z internetu, které nemají jinou online kategorii (rozpozná i „Playboy Plus“, „Playboy.com“).

### Opraveno
- Statistiky, přibývání sbírky: červen a červenec měly stejnou zkratku „Čer“; teď Čvn a Čvc jako na páskách čísel.

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
