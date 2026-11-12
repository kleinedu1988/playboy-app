# Changelog

Všechny podstatné změny programu Pinup Katalog. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze mají tvar X.XX.XXX (MAJOR.MINOR.PATCH s pevnou šířkou, např. 0.02.003) podle oddílu „Pravidlo verzování“
v [ROADMAP.md](ROADMAP.md).
Historie do 1.53.0 (program se jmenoval Playboy Database) je v
[docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md](docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md).

## [0.02.078] – 2026-11-12

### Změněno
- **Soubory sbírky přejmenovány:** při prvním startu se `playboy.db` přejmenuje na `katalog.db` a databáze učení
  `playboy-uceni.db` na `katalog-uceni.db` (i s rozepsaným WAL). Předtím se uloží záloha „Před přejmenováním
  souborů“. Na starých místech zůstanou odkazy na nové soubory, takže i starší verze programu otevře stejnou
  sbírku a nezaloží si prázdnou. Když přejmenování nejde, program zůstane u starých názvů a zkusí to příště.
- Nové zálohy se jmenují `katalog-…db`. Staré `playboy-…db` zůstávají: v Obnovit ze zálohy, v úklidu záloh i na
  Google Disku se řadí s novými podle času a jdou obnovit jako dřív.

### Ověřeno
- Test: sbírka s WAL a databází učení se přejmenuje, odkazy vedou na nové soubory a přes odkaz je vidět stejná
  sbírka; záloha před přejmenováním má všechny modelky; stará záloha `playboy-…` je v seznamu na správném místě a
  obnoví se, odkaz po obnovení zůstane odkazem. Všechny testy, typy a build prošly.
- Kopie sbírky: přejmenována, odkazy vytvořené, okno záloh ukazuje novou zálohu (613 modelek, 23 260 fotek)
  nad staršími `playboy-…`.

## [0.02.077] – 2026-11-12

### Přidáno
- **Balíček pro telefon:** po nahrání zálohy na Google Disk (sama s denní zálohou i tlačítkem Nahrát teď) se do
  skryté složky programu nahraje i malý výtah sbírky `telefon-balicek.json.gz`, ze kterého si telefon (další
  kroky) složí stránku modelek: jména, srdíčka a oblíbenost, kategorie a tituly, čísla, titulní fotka dlaždice
  a profilová fotka pro hero banner s výřezy. Fotky jsou jen jako odkazy (Drive ID a šablona adresy), telefon si
  náhledy stáhne z Disku jako PC. **Explicitní fotky se do balíčku nedostanou** – titulní nebo profilová fotka,
  která je explicitní (potvrzená nebo jistý odhad, jako v Galerii), se vynechá. Nový balíček nahradí starý.

### Ověřeno
- Test: 3000 modelek = 52 kB (limit 5 MB), explicitní titulní fotka vypadne, po dvou nahráních je na Disku jeden
  balíček. Kopie sbírky: 613 modelek, 543 titulních a 98 profilových fotek = 52 kB.
- Snímek s falešným Diskem: Nahrát teď oznámí „Záloha i balíček pro telefon jsou na Google Disku.“
- **Neověřeno:** skutečný Google Disk.

## [0.02.076] – 2026-11-12

### Přidáno
- **Záloha na Google Disk:** po přihlášení ke Googlu se denní záloha sama nahraje do skryté složky programu na
  Disku (appDataFolder – v Disku ji nevidíš a program nevidí nic jiného). Na Disku zůstává posledních sedm denních
  záloh. Přístupový token se obnovuje sám.
- ⋯ › Obnovit ze zálohy… má oddíl **Na Google Disku**: seznam záloh s velikostí, **Nahrát teď** (nahraje
  dnešní denní zálohu hned) a **Stáhnout** u záloh, které nejsou mezi místními. Stažená záloha se ověří a objeví
  se mezi místními, obnoví se obvyklou cestou (Obnovit… s porovnáním rozdílů) – takže jde obnovit i čistý
  program po přihlášení.
- Snímkovač: `FALESNY_DISK=1` nahradí Google i Disk místním serverem.

### Ověřeno
- Test s falešným Diskem: devět denních záloh se nahraje, zůstane posledních sedm, opakované nahrání nic
  nepřidá; bez přihlášení se nenahrává nic; stažení do prázdné složky záloh vrátí čitelnou databázi.
- Snímek: oddíl Na Google Disku po Nahrát teď ukazuje dnešní zálohu (10,9 MB, „je i mezi místními“).
- **Neověřeno:** skutečný Google Disk.

## [0.02.075] – 2026-11-12

### Přidáno
- **Vstup do programu přes Google:** když má program přihlašovací údaje (`google-klient.json`), je přihlašovací
  okno vstupní branou – při startu se ukáže před otevřením sbírky (po případném hesle), nejde zavřít ani Esc a
  sbírka se otevře až po přihlášení. Přihlášení si program pamatuje jako jiné aplikace: příště startuje rovnou.
  Brána se znovu ukáže po Odhlásit (⋯ › Nastavení › Účet Google…) nebo když Google přístup odvolá – zapamatované
  přihlášení se při startu na pozadí ověří obnovovacím tokenem. Bez připojení zapamatované přihlášení platí dál.
  Bez přihlašovacích údajů programu brána není (sbírka nesmí zůstat zamčená).

### Odebráno
- „Pokračovat bez přihlášení“ z verze 0.02.074 (přihlášení je teď vstup).

### Ověřeno
- Test: ověření zapamatovaného přihlášení obnoví přístup; odvolaný přístup (invalid_grant) token smaže; nové
  přihlášení po odvolání. Všechny testy, typy a build prošly.
- Snímek s dočasnou složkou nastavení a falešnými údaji programu: při startu brána „Přihlášení“ s fotkou
  (Gig Gangel), bez křížku; Esc ji nezavře.
- **Neověřeno:** skutečné přihlášení u Googlu (čeká na OAuth klienta).

## [0.02.074] – 2026-11-12

### Přidáno
- **Účet Google** (⋯ › Nastavení › Účet Google…): přihlašovací okno ve stylu programu – vlevo panel
  s burgundským přechodem, zlatým názvem programu a tlačítkem „Přihlásit přes Google“, vpravo velká fotka oblíbené
  modelky (náhodně z nejlépe hodnocených, chytrý výřez s obličejem) s popiskem „Playmate měsíce · Listopad 2009 —
  Jméno“; v úzkém okně je fotka přes celé okno a panel průhlednou kartou. Fotka, která se nenačte, se vymění za
  další; se zámkem sbírky se fotka neukazuje.
- Přihlášení v systémovém prohlížeči (OAuth 2.0 pro desktop: návrat na `127.0.0.1`, PKCE, ověření `state`);
  heslo program nevidí. Rozsahy jen `drive.file` (soubory, které program sám vytvoří) a `drive.appdata` (jeho
  skrytá složka) – k fotkám sbírky přístup nedává. Token je v `~/.config/pinup-katalog/google-token.json` s právy
  0600; Odhlásit ho smaže a odvolá u Googlu. Čekání jde zrušit (Zrušit, Esc), po 5 minutách vyprší.
- Okno se při startu ukáže samo, jen když program má přihlašovací údaje (`google-klient.json`), uživatel není
  přihlášený a nezvolil „Pokračovat bez přihlášení“.

### Ověřeno
- Test celého přihlášení s místním serverem místo Googlu: adresa autorizace (rozsahy, PKCE S256, návrat na
  127.0.0.1), výměna kódu s ověřením PKCE, jméno a e-mail z id_token, token s právy 0600, odmítnutí cizího
  `state`, „Pokračovat bez přihlášení“, odhlášení s odvoláním tokenu.
- Snímek okna (1280 px) na kopii sbírky: panel, hláška o chybějících údajích s cestou, fotka Kelley Thompson
  s popiskem. Typy, build a testy prošly.
- **Neověřeno:** skutečné přihlášení u Googlu (chybí OAuth klient) a úzké rozvržení (snímkovač okno nezúžil).

## [0.02.073] – 2026-11-12

### Přidáno
- **Mapa sbírky obarvená časopisem:** ve sbírce z víc časopisů má Mapa sbírky barvu „Časopis“ – Playboy, Penthouse,
  Hustler, jiný časopis, víc časopisů (modelka vyšla ve dvou a víc) a bez čísla. Legenda ukazuje jen hodnoty, které
  ve sbírce jsou; klik na ni vybere modelky jako u ostatních barev.

### Ověřeno
- Snímek na kopii sbírky: playmates růžově, 3 Pets modře; legenda Playboy · Penthouse · Bez čísla; klik na
  Penthouse vybere Heide Mann, Ilse Hasek a Ullu Lindstrom. Typy a build prošly.

## [0.02.072] – 2026-11-12

### Přidáno
- **Srovnat časopisy** (Statistiky › Srovnání, jen ve sbírce z víc časopisů): modelky jen z Playboye (A) proti
  modelkám jen z druhého časopisu (B, volba časopisu, když je jich víc); modelky z obou se nepočítají. Testují se
  všechny údaje jako u Porovnat období (Mann–Whitney, Fisher, oprava Benjamini–Hochberg) a navíc rok prvního
  výskytu („Playboy: modelka vyšla o 15 let dřív (medián 1983 vs 1998)“). Seznam vpravo ukazuje modelky obou
  skupin, menší časopis napřed; CSV a tisk jako u srovnání období.

### Změněno
- Výsledek Porovnat období a srovnání časopisů sdílí jedno vykreslení; hláška o málo modelkách mluví o skupinách.

### Ověřeno
- Test: věta o roce prvního výskytu se správným skloňováním a rokem bez mezery („1983“). 233 JS testů, typy
  a build prošly.
- Snímek na kopii sbírky: Playboy 568 vs Penthouse 3 modelky, hláška, že na srovnání je potřeba aspoň 10 v každé
  skupině.

## [0.02.071] – 2026-11-12

### Přidáno
- **Filtr časopisu ve Statistikách:** ve sbírce z víc časopisů je ve Filtrech volba Playboy / Penthouse / …
  Playboy (výchozí) ukazuje celou sbírku a výskyty v Playboyi jako dřív; jiný časopis omezí všechny grafy, hero
  i mapu na jeho modelky a rok prvního výskytu bere z čísel toho časopisu. Výběr a edice se se změnou časopisu
  zruší; časopis zůstane i po načtení čerstvých dat.

### Opraveno
- Souhrn grafu skloňuje i malé počty („3 modelky · 1969–1970“, „známé u 3 modelek“) – s filtrem časopisu jsou
  běžné.

### Ověřeno
- Snímky na kopii sbírky: Penthouse ukáže 3 Pets (1969–1970) v grafu podle roku i výšky, návrat na Playboy celou
  sbírku (567 modelek s výškou). Typy, build a 232 JS testů prošly.

### Neuděláno
- Barva časopisu v grafech (sloupce rozdělené podle časopisu) je přesunutá do Možných.

## [0.02.070] – 2026-11-12

### Přidáno
- **Můj vkus v čase s časopisem:** ve Statistikách › Můj vkus v čase je mezi vlastnostmi i jiný časopis než
  Playboy, pokud v něm vyšlo aspoň 20 modelek sbírky. Když se posun průkazně ukáže v soubojích, přibude věta
  „Za poslední rok se ti víc líbí modelky Penthouse…“ (nebo „…líbí méně než dřív“).

### Ověřeno
- Test: průkazný posun k modelkám Penthouse dá větu; sbírka jen z Playboye vlastnost časopisu nemá. Všech 232
  JS testů prošlo (časový test mapy jednou selhal jen při souběhu všech testů, samostatně prošel).
- Na kopii sbírky se nic nemění: modelek Penthouse je méně než 20.

## [0.02.069] – 2026-11-12

### Přidáno
- **Podobné modelky napříč časopisy:** společný jiný časopis než Playboy (číslo, centerfold, obálka) zvedá
  podobnost a je první důvod („Penthouse · 1970. léta · …“). Dvojice jen z Playboye se počítá jako dřív.
- **Objevit:** nabízí modelky všech časopisů; odhad i jeho důvod s časopisem bere z modelu vkusu (0.02.068).

### Ověřeno
- Test: Pets si jsou podobnější a důvod jmenuje časopis; u dvojice jen z Playboye se podobnost nemění.
- Snímek na kopii sbírky: u Ilse Hasek jsou mezi podobnými první Heide Mann a Ulla Lindstrom, obě s důvodem
  „Penthouse“.

## [0.02.068] – 2026-11-12

### Přidáno
- **Časopis jako vlastnost vkusu:** model vkusu (odhad srdíček, Mohlo by se ti líbit) bere jiné časopisy než
  Playboy, ve kterých modelka vyšla (číslo, centerfold, obálka), jako její údaj. Důvod odhadu pak může říct
  „Penthouse“ a věta tipu „vyšla v časopise Penthouse“. Playboy se jako vlastnost nepočítá (měla by ji skoro
  každá modelka), takže čistě playboyová sbírka se nemění; počet skupin údajů (bohatost) zůstává stejný.

### Ověřeno
- Test: údaj časopisu u Penthouse a Hustleru, ne u Playboye, bohatost údajů beze změny; ve sbírce, kde se líbí
  modelky Penthouse, má odhad nehodnocené modelky Penthouse důvod „Odhad 4½ srdíčka: Penthouse; podobně jako…“.
  Všechny dosavadní testy vkusu beze změny.
- Na kopii sbírky se zatím nic nemění: modelky Penthouse jsou 2 a žádná hodnocená (vlastnost se počítá až od 3
  hodnocených).

## [0.02.067] – 2026-11-12

### Přidáno
- **Úplnost čísla Penthouse:** stránka měsíčního čísla Penthouse US nabídne „Pet of the Month podle
  Wikipedie…“ (italský seznam Pets, jako Ročník v 0.02.064). Pet je „v čísle ve sbírce“ jako centerfold i jako
  album s titulem měsíce; chybějící jde přidat rychlým oknem s předvyplněnou řadou Penthouse US (dřív by se
  předvyplnil Playboy). Víc Pets v jednom měsíci se ukáže jako „A a B“. Hustler seznam nemá (0.02.065).

### Ověřeno
- Test: Pet čísla 01/1985 se najde ve sbírce, 04/1985 chybí, měsíc mimo seznam a britská edice hlásí chybu;
  Playboy beze změny (starší testy).
- Snímky na kopii sbírky (živá Wikipedie): Penthouse 03/1970 → „Pet of the Month: Ilse Hasek ✓ v čísle ve
  sbírce“; 01/1970 → „Katherine Mannering ve sbírce není · přidat…“.

## [0.02.066] – 2026-11-12

### Přidáno
- **Odkazy z webů časopisů:** adresa stránky Penthouse, Playboye, Hustleru (i poddomény) a archivu
  magazine-empire.com se pozná podle domény; z adresy se vezme rok, měsíc (2019-06, june, jun) a titul (of the
  month / of the year). Čte se jen adresa, stránka se nestahuje.
  - Rychlé okno Nová modelka: vložený odkaz předvyplní časopis a číslo prvního výskytu (jen když rok ještě není
    vyplněný) a ohlásí to.
  - Zásobník odkazů v profilu: Ctrl+V přijme i odkaz na stránku časopisu, souhrn ukáže „odkaz z webu: Penthouse,
    červen 2002“ a „Nové album…“ z něj předvyplní číslo (bez roku aspoň časopis).

### Ověřeno
- Testy rozpoznání (Penthouse, Playboy US i CZ, Hustler, magazine-empire, odkaz bez roku; Disk, Wikipedie a
  podobná doména se nerozpoznají) a popisu pro oznámení.
- Snímky na kopii sbírky: zásobník u Victorie Zdrok ukáže „odkaz z webu: Penthouse, červen 2002 – nové album
  předvyplní číslo“; rychlé okno po vložení odkazu: rok 2002, měsíc 06, Penthouse US a oznámení.
- Předvyplnění okna alba ze zásobníku na snímku nezkoušeno (potřebuje platné odkazy na Disk).

## [0.02.065] – 2026-11-12

### Přidáno
- **Tituly z Wikidat:** ocenění Penthouse Pet (měsíce), Penthouse Pet of the Year a Hustler Honey s datem se
  nabídnou jako údaj „Tituly (Pet, Honey)“ v okně Doplnit z webu i ve frontě Údržba › Z webu (jako doplnění,
  jen tituly, které modelka ještě nemá). Přijetí založí prázdný centerfold čísla (`2002-06@PH`) nebo album titulu
  roku („Pet of the Year 2004“, číslo `2004@PH`); fotky se doplní později. Vrátit v Údržbě založená alba smaže.
  Ocenění časopisu také pomůže najít správnou osobu na Wikidatech u modelek, které nejsou Playmate.
- Prázdné album titulu roku jiného časopisu platí jako titul (jako prázdný centerfold).

### Změněno
- Krok „Hustler Honeys“ zrušen: seznam Honeys nemá žádná Wikipedie a Wikidata mají Honey jen u 3 modelek.
  Další kroky se posunuly o jedno (mobil 0.02.074–0.02.080, alfa 0.02.085+).

### Ověřeno
- Test s falešnými Wikidaty: návrh jen chybějících titulů (už zapsaný Pet měsíce se nenabídne, ocenění bez
  měsíce a neznámé ocenění se vynechají), zápis, opakovaný zápis nezdvojí alba, fronta Údržby jako doplnění,
  přijetí a Vrátit.
- Snímek na kopii sbírky (živé zdroje): Doplnit z webu u Victorie Zdrok nabídne „+ Pet of the Month červen 2002,
  Pet of the Year 2004“ (Wikidata). Uložení v okně na snímku nezkoušeno (kopie zůstala beze změny).
- Na Wikidatech je 278 Pets měsíce a 31 Pets roku s datem; v kopii sbírky je mezi nimi 8 modelek.

## [0.02.064] – 2026-11-12

### Přidáno
- **Ročník podle Wikipedie pro Penthouse:** v Kalendáři s řadou Penthouse (nabídka roku) a na stránce ročníku
  Penthouse tlačítko „Podle Wikipedie…“. Porovná Pets měsíců a Pet of the Year se sbírkou (ve sbírce, podobné
  jméno, jiný měsíc, chybí); chybějící jdou přidat rychlým oknem s předvyplněným jménem a číslem Penthouse.
  Anglická Wikipedie seznam Pets nemá, zdrojem je italská stránka „Penthouse Pet“. Pet ve sbírce se pozná
  podle centerfoldu i alba s titulem měsíce v čísle `RRRR-MM@PH`.

### Ověřeno
- Test s falešnou Wikipedií: shoda (album titulu i centerfold), jiný měsíc, chybí, měsíc mimo seznam, Pet roku;
  stejný měsíc Playboye se s Penthouse neplete; Hustler hlásí, že seznam nemá. Playboy beze změny (starý test).
- Parser na skutečném textu stránky: 1985 – 12 Pets, 1992 i Pet of the Year (Jisel), 2025 – 5 měsíců. Italský
  seznam nemá Pet of the Year 1985, takový řádek pak chybí.
- Snímky na kopii sbírky (živá Wikipedie): ročník 1985 – 0 z 12, Angela Nicholas ve sbírce bez čísla; ročník
  1970 – Ilse Hasek a Heide Mann ✓, ostatní k přidání.

## [0.02.063] – 2026-11-12

### Přidáno
- **Učení z potvrzení:** potvrzené druhy fotek doladí odhad (muž na fotce: sex a „jen s mužem“ ano, pózovací
  a lesbická ne; víc žen: lesbická ano, pózovací ne). Učí se z vestavěných vah a drží se jich; kotvou je vzorek
  sbírky a nejsilnější nepotvrzené návrhy s cílem podle vestavěného odhadu, takže se odhad mění jen tam, kam
  ukazují potvrzení. Doladěný odhad používají návrhy v Údržbě i skrývání v Galerii.
- **Údržba › Druh fotek:** „Od nejjistějších / Sporné první“ (sporné = nejméně jisté návrhy) a věta, z kolika
  potvrzených fotek je odhad doladěný.

### Opraveno (během vývoje)
- První verze učení brala vzorek sbírky jako „ne“: hromadné potvrzení 24 fotek „víc žen“ jako pózovací pak
  smazalo všechny návrhy víc žen (179 → 0) a srazilo i „muž na fotce“ (55 → 17). Kotva s cílem z vestavěného
  odhadu a držení posunu to opravily.

### Ověřeno
- Test: odhad, který plete pózovací skupinu s kladnou, ji po 20 potvrzeních „ne“ přestane navrhovat a kladnou
  skupinu ponechá; bez potvrzení zůstanou vestavěné váhy.
- Snímky na kopii sbírky: 24 potvrzených „pózovací“ z „Víc žen“ → návrhy víc žen 179 → 139 (24 potvrzených a 16
  podobných), muž na fotce 55 → 53, věta „doladěný z 24 potvrzených fotek“; „Sporné první“ řadí od 85 %.
  Zkušební potvrzení z kopie smazána.
- Simulace na mém ručním vzorku (nástroj `druh-mereni -simulace`) je malá – 9 a 5 potvrzení: muž na fotce
  správné návrhy 4 → 6 při stejných 3 chybných, víc žen beze změny. Že po 20 opravách ubude chybných návrhů,
  ukáže až používání (K-VYZKOUSENI).

## [0.02.062] – 2026-11-12

### Změněno
- **Galerie zvlášť:** fotky se sexem a lesbické scény už nejsou v řadách kolekcí, v heru ani ve Všech fotkách.
  Patří mezi ně potvrzené (sex, lesbická) a nepotvrzené s jistým odhadem (≥ 95 %); potvrzená „pózovací“
  a „jen s mužem“ zůstávají v běžné galerii.
- Vlastní řada a kolekce **Páry a lesbické**: v Galerii vždy jako poslední řada (nepočítá se do deseti řad dne,
  do hera nejde), v panelu Kolekce vlastní skupina; „Zobrazit vše“ ukáže všechny.
- Ve Filtrech Všech fotek **Páry a lesbické: Skrýt / Ukázat i je / Jen je** (pamatuje se, štítek v liště
  s křížkem vrátí „Skrýt“).

### Ověřeno
- Test: potvrzený sex zmizí z galerie, „Jen je“ ukáže jen jej, „Ukázat i je“ obě fotky, kolekce Páry a lesbické
  jen jej; po změně na „jen s mužem“ se fotka vrátí (i ve stejné sekundě).
- Snímky na kopii sbírky (bez potvrzení, jen odhady): řady dne + poslední „Páry a lesbické“ (Zobrazit vše 173),
  filtr Jen je → 173 fotek, křížek štítku → zpět 23 078. V odhadech převažují skupinové pózovací fotky víc žen –
  ty se podle volby počítají jako lesbické; když nemají být skryté, stačí je v Údržbě potvrdit jako pózovací.

## [0.02.061] – 2026-11-12

### Přidáno
- **Potvrzený druh fotky** – úprava schématu databáze č. 19 a formát exportu verze 16 (se souhlasem uživatele):
  pózovací, lesbická, sex, nebo jen s mužem (scéna bez sexu, třeba zákulisí). Platí pro soubor na Disku ve
  všech albech, v exportu je u fotky pole `druh` (EXPORT.md). Před úpravou databáze se udělá záloha.
- **Údržba › Otočené a výřezy › Druh fotek:** u každé navržené fotky tlačítka druhu, pod skupinou potvrzení
  všech zobrazených najednou; potvrzená fotka ze seznamu zmizí, nahoře souhrn potvrzených, vždy jde „Vrátit“.
- **Nabídka fotky › Druh fotky…** (⋯ v prohlížeči i pravý klik na dlaždici): výběr druhu se zatržením
  potvrzeného a „Nepotvrzený (zrušit)“.

### Ověřeno
- Testy: uložení s kontrolou druhu a souboru, export a import tam a zpět, import bez druhu nebo s neznámým druhem
  potvrzení nesmaže; zmrazení schématu na úpravě 19 a exportu 16.
- Snímky na kopii sbírky: migrace 18 → 19 se zálohou „před úpravou databáze“; „Sex“ u první fotky (návrhů
  234 → 233, souhrn „sex 1“), „Všech 24 zobrazených: Lesbická“ (→ 209) a „Vrátit“ (→ 233); v prohlížeči
  Druh fotky… › Jen s mužem a znovu otevřená nabídka ukáže zatržení. Zkušební potvrzení z kopie smazána.
- Galerie zatím potvrzené fotky neodděluje – to je další krok.

## [0.02.060] – 2026-11-12

### Přidáno
- **Údržba › Otočené a výřezy › Druh fotek (návrh):** program z obsahu fotek odhadne, na kterých je muž (scény
  s mužem) a na kterých je víc žen, a ukáže je ve dvou skupinách od nejjistějších s jistotou v rohu náhledu.
  Zatím jen ke kontrole – potvrzení a oddělení od pózovacích fotek přijdou v dalších verzích.
- Odhad je naučený z ručně roztříděných fotek nad vektory CLIP, které sbírka už má (vestavěné váhy, nic se
  nestahuje ani nepřepočítává); nástroj `internal/obsah/druh-mereni -ucit` ho umí naučit znovu.

### Změřeno
- Větší detektor NudeNet 640m nepomohl: muže ve scénách se sexem najde u 3 ze 17 (bývá zády nebo z profilu) a je
  asi 5× pomalejší – nezapojuje se. Naučený odhad: „víc žen“ ~91 % zásahů správně, „muž na fotce“ ~70 %
  (křížová validace); na kontrolních listech z celé sbírky při jistotě ≥ 85 % sedí zhruba 9 z 10.

### Ověřeno
- Snímky na kopii sbírky: sekce „Druh fotek · návrh 234“ (Muž na fotce 55, Víc žen 179), náhledy s jistotou,
  „Ukázat dalších“ přidá další. Nejjistější „muž na fotce“ jsou často oblečené scény ze zákulisí – proto návrh.

## [0.02.059] – 2026-11-11

### Změřeno (Explicitní fotky zvlášť, krok Rozpoznání)
- Jak dobře stávající modely poznají druh fotky (pózovací / lesbická / sex) – vzorek 300 fotek (200 Penthouse,
  100 Playboy) roztříděný ručně a kontrolní listy kandidátů z celé sbírky:
  - **detektor** (NudeNet 320n): muže na fotce skoro nevidí (nejvyšší jistoty „obličej muže“ mají často samotné
    ženy) a lesbické nepozná vůbec – ukládá jen nejvyšší jistotu obličeje, ne kolik obličejů na fotce je;
  - **popis scény z CLIP** (bez nového modelu): fotky „dvě a víc žen“ pozná dobře (~84 % zásahů správně, 298 ve
    sbírce), „pár při sexu“ špatně (~35 % zásahů má na fotce muže).
- Podmínka „9 z 10“ pro sex nevyšla, proto se podle plánu vkládá krok **Větší detektor a druh fotky** (0.02.060,
  NudeNet 640m a počet obličejů); Galerie zvlášť, Ruční oprava, PDF a další kroky se posouvají o 1.

### Přidáno (pro vývoj)
- Nástroj `internal/obsah/druh-mereni`: CSV jistot detektoru a podobností fotek s popisy scén (`popisy.txt`)
  pro opakování měření s větším detektorem.

## [0.02.058] – 2026-11-11

### Přidáno
- **Úprava výřezu ručně (Chytrý výřez náhledů, poslední krok):** v nabídce fotky (⋯ v prohlížeči i pravý klik na
  dlaždici) „Upravit výřez náhledu…“. Okno ukáže celou fotku s bodem zájmu – klik nebo tažení ho přesune,
  posuvník přiblíží – a vedle živé náhledy ve třech tvarech rámu (dlaždice, čtverec, široký pás). Bod začíná na
  ručním výřezu, jinak na obličeji nebo postavě z detektoru. „Uložit výřez“ ho uloží pro fotku ve všech albech
  a náhledy na obrazovce se hned posunou; „Automaticky“ ruční výřez smaže. Otočené fotky položku nemají.
- **Údržba › Otočené a výřezy › Výřezy náhledů:** fotky, na kterých detektor postavu nenašel (náhled je na
  středu), od nejlépe hodnocených po 24; klik otevře úpravu výřezu, uložená fotka ze seznamu zmizí.

### Ověřeno
- Snímky na kopii sbírky: v Údržbě 190 fotek bez postavy, úprava (bod 30 % / 20 %, přiblížení 1,6×) se uložila
  a seznam klesl na 189; z prohlížeče: položka v nabídce, okno nad prohlížečem s bodem na obličeji, uložení,
  znovu otevřené okno nabídlo „Automaticky“ a to výřez smazalo. Zkušební výřezy z kopie smazány.
- Neověřeno: že žádný náhled není horší než střed – to ukáže až běžné používání (ruční výřez jde vždy vrátit).

## [0.02.057] – 2026-11-11

### Přidáno
- **[schéma] [export] Ruční výřez fotky (Chytrý výřez náhledů):** se souhlasem uživatele úprava schématu č. 18
  (tabulka `vyrezy_fotek`: bod zájmu v % a přiblížení 1–4 podle souboru na Disku) a export verze 15 (`vyrez`
  u fotky, popis v EXPORT.md, ukázka ve vzor-exportu.yaml). Ruční výřez platí pro fotku ve všech albech a má
  přednost před automatickým: náhled dá bod zájmu doprostřed rámu a přiblíží kolem něj (jen v rámu, který
  obrázek ořezává). Před úpravou schématu se databáze sama zazálohuje (`pred-migraci`).
- Rozhraní pro zápis (`SetRucniVyrez`, `SmazatRucniVyrez`); úpravu tažením v prohlížeči fotek přidá 0.02.058.

### Ověřeno
- Test Go: meze, přednost před automatickým, export → import do prázdné sbírky, import bez výřezu ho nesmaže.
  Test rozhraní: poloha bodu a přiblížení u okraje.
- Kopie sbírky: schéma 17 → 18 se zálohou před migrací; ruční výřez (90 %, 10 %, 2×) se po novém spuštění
  projevil v Galerii (dlaždice přiblížená k bodu vpravo nahoře, v rámu).

## [0.02.056] – 2026-11-11

### Přidáno
- **Propojení ven a zpět (Přehledná Sbírka, krok 5 – poslední):** profil modelky (v řádku pod jménem) a stránka
  čísla (pod názvem) ukazují „N úkolů ve Sbírce“, když modelka nebo číslo nějaké má. Klik otevře Sbírka › Úkoly
  › Po modelkách přímo na jejich kartě; Zpět vrátí na profil / číslo.
- Jméno na kartě úkolu (Po modelkách) otevře profil modelky nebo stránku čísla; Zpět vrátí na tutéž kartu.
  Rozepsané údaje na kartě se před odchodem potvrdí.
- Počty úkolů se spočítají na pozadí i bez otevření Sbírky a po změně dat znovu.

### Ověřeno
- Snímky na kopii sbírky (Sbírka předtím neotevřená): profil Layla Roberts → „21 úkolů ve Sbírce“ → karta Layla
  Roberts v Po modelkách → Zpět na profil; z karty jménem na profil → Zpět na kartu; Únor 1954: karta → číslo
  („2 úkoly ve Sbírce“) → Zpět na kartu → číslo → odkaz → karta Únor 1954.

## [0.02.055] – 2026-11-11

### Přidáno
- **Proklik ukazatelů (Přehledná Sbírka, krok 4):** dlaždice Modelky, Alba a Čísla v hlavičce Sbírky jsou tlačítka.
  Klik ukáže, co v oblasti chybí (např. Titulní fotka – 65 chybí), a vede tam, kde se to doplní: Údaje do Úkolů
  › Po údajích, ostatní do Fronty s filtrem oblasti; u Čísel navíc Mapa čísel a sháněná čísla.
- Řádky Na pozadí v Přehledu (Otisky, Otočení, Kvalita fotek, Průchod webem) otevřou režim Úkolů, kde se jejich
  výsledek řeší (Stejné fotky, Otočené a výřezy, Z webu).
- Nabídka políčka v mapě čísel má „Úkoly čísla (N)“: otevře Úkoly › Po modelkách přímo na kartě čísla.

### Opraveno
- Úkoly › Po modelkách: karta modelky nebo čísla nebyla vidět (zbyl jen malý náhled a fronta uprostřed). Mřížka
  fotek z režimu Otočené a výřezy měla stejný název třídy a přebíjela rozložení karty – chyba od 1.45.0.
  Třídy fotek mají vlastní předponu.

### Ověřeno
- Snímky na kopii sbírky: Modelky › Údaje → Po údajích; Alba › Texty → Fronta s filtrem Texty alb; Čísla › Mapa →
  Čísla a sháním; Únor 1954 v mapě → Úkoly čísla (2) → karta čísla v Po modelkách; Otisky → Stejné fotky.
  Karta Po modelkách 846 px + fronta 340 px; Otočené a výřezy dál po čtyřech v řadě.

## [0.02.054] – 2026-11-11

### Opraveno
- **Jedno počítání úkolů (Přehledná Sbírka, krok 3; nahlášeno):** hlavička Sbírky ukazovala 1 135 úkolů, Přehled
  2 661. Hlavička počítala modelky a čísla, kterým něco chybí, Přehled jednotlivé úkoly. Teď je „úkol“ všude
  jedna otevřená položka (údaj, kontrola, návrh…): hlavička, lišta (Úkoly 2 661), Přehled („ve frontě“), mapa
  sekcí, stavový pás i Zdraví sbírky ukazují stejné číslo s mezerou v tisících. Kolik je to modelek a čísel,
  řekne popisek („2 661 úkolů u 1 135 modelek a čísel“); filtr Vše ve Frontě v popisku vysvětluje, že počítá
  řádky fronty.
- Počet úkolů v hlavičce je odkaz na stránku Úkoly.

### Ověřeno
- Snímky na kopii sbírky: hlavička, lišta, Přehled i mapa sekcí shodně 2 661; test modelu (3 úkoly u jedné modelky).

## [0.02.053] – 2026-11-11

### Změněno
- **Celé stránky Sbírky (Přehledná Sbírka, krok 2):** Čísla a sháním a Učení jsou celé stránky pod lištou Sbírky
  místo výsuvného panelu přes Údržbu. Mají jeden posuvník (okna); mapy čísel se roztáhnou na celou šířku.
  Hlavička panelu s křížkem a klávesy I / Esc pro panel odpadly, stránky přepíná lišta.
- Každá stránka Sbírky si v rámci spuštění pamatuje, kam byla odrolovaná, a po návratu se tam vrátí.

### Opraveno
- Učení bylo prázdné, dokud se neotevřel režim Fronta: obsah se plnil jen tam. Teď se vyplní při každém
  vykreslení, z jakékoli stránky.

### Plán
- ROADMAP u Explicitních fotek (dotaz uživatele na obrazový model): krok Rozpoznání nejdřív změří přesnost
  s dnešním detektorem a CLIP popisem scény. Když nevyjde 9 z 10, přibude krok Větší detektor (NudeNet 640m).

### Ověřeno
- Snímky na kopii sbírky: Čísla a sháním a Učení na celou šířku s jediným posuvníkem; Úkoly odrolované na 600 px
  → Čísla → Učení → zpět na Úkoly vrátí 600 px, Čísla také.

## [0.02.052] – 2026-11-11

### Změněno
- **Jedna lišta Sbírky (Přehledná Sbírka, krok 1; nahlášeno):** pod hlavičkou Sbírky je jediná lišta se čtyřmi
  stránkami **Přehled · Úkoly · Čísla a sháním · Učení**. Přehled je dřívější Dnes. Úkoly mají pod lištou přepínač
  režimů (Po údajích, Po modelkách, Stejné fotky, Otočené a výřezy, Z webu, Fronta) a filtry fronty; na ostatních
  stránkách druhá lišta není.
- Přidat (modelku, centerfold, cover), Importovat, Exportovat a Zkontrolovat soubory jsou v tlačítku **Akce ▾**
  vpravo místo řady tlačítek.
- Lišta, mapa sekcí i cesta Zpět se kreslí z jednoho seznamu (`lib/stranky-sbirky.js`), takže se všude jmenují
  stejně. Dřív mapa říkala Údržba / Souhrn / Mapa čísel / Sháním CZ a Učení v ní chybělo.
- Úkoly se otevřou v naposledy použitém režimu. Pod panelem Čísla a sháním / Učení je Přehled, takže se fronta
  úkolů vedle panelu neláme. Z panelů budou celé stránky v 0.02.053.
- Nápověda popisuje čtyři stránky.

### Ověřeno
- Snímky na kopii sbírky (`nastroje/snimky/sbirka.json`): přepnutí všech čtyř stránek, nabídka Akce, mapa sekcí
  se zvýrazněnou stránkou, skok z mapy na Úkoly › Z webu a z Profilů rovnou na Čísla a sháním.

## [0.02.051] – 2026-11-11

### Změněno
- **Tvar podle místa (Chytrý výřez náhledů, krok 3):** výřez se řídí skutečným poměrem rámu. Dlaždice a úzký rám
  hera vedle textu (Kalendář, Centerfoldy, Obálky: 3 : 4) mají obličej uprostřed a kousek pod horní hranou. Široký
  rám (od 1,6 : 1) nechá nad obličejem víc místa, aby byl vidět i trup. Široký banner s textem vlevo (hero Galerie)
  posune postavu doprava od textu.
- Výřez dostaly hero Kalendáře, Centerfoldů, Obálek a Galerie. U Kalendáře a Obálek se ID souboru bere z adresy
  obrázku (`idZAdresy`).

### Plán
- ROADMAP: nový blok **Explicitní fotky zvlášť** (0.02.054–0.02.056, přání uživatele). Sex a lesbické fotky
  (hlavně Penthouse a Hustler) budou ve výchozím stavu jen ve vlastní řadě Galerie, ne mezi pózovacími. PDF
  a další kroky se posunuly o 3 (Označit stránky = 0.02.057, alfa 0.02.076+).

### Ověřeno
- Snímky herů na kopii sbírky (střed proti výřezu): v heru Galerie je vidět celý obličej (dřív useknuté čelo),
  v heru Kalendáře celá postava i s nohama; centerfold zůstal stejně dobrý jako dřív.

## [0.02.050] – 2026-11-11

### Změněno
- **Náhledy podle výřezu (Chytrý výřez náhledů, krok 2):** ořezané náhledy se posunou tak, aby byla vidět postava
  a hlavně obličej, místo pevného středu. Platí v řadách kolekcí a panelu kolekcí Galerie, v mozaice alb profilu,
  v pásu fotek Porovnat, ve frontě Hodnotit, v pásu prohlížeče, v Dnešním výběru, v Ideální modelce a v pásu
  fotek na stránce čísla. Pohled jen označí obrázek (`data-vyrez`); výřezy po dávkách načte a použije jeden modul
  (`app/vyrez-nahledu.js`, výpočet v `lib/vyrez-nahledu.js`). Otočené fotky a fotky bez spočítaného výřezu
  zůstávají na středu.

### Ověřeno
- Snímky obrazovek na kopii sbírky (střed proti výřezu, úloha `nastroje/snimky/vyrez.json`): v Galerii se
  posunulo 83 ze 150 dlaždic; ležící modelce a dalším dvěma fotkám je teď vidět obličej. V mozaice profilu se
  posunulo 10 z 10 dlaždic; dvěma fotkám už střed neuřízne hlavu.

### Opraveno
- Skutečná databáze zůstala po rozpracované verzi 0.02.049 na úpravě schématu 18 (prázdná tabulka ručních výřezů,
  která se do vydání nedostala) a program 17 ji otevřel jen pro čtení. Tabulka byla odstraněna a databáze vrácena
  na úpravu 17 (záloha `zalohy/playboy-2026-11-11-oprava-schema18.db`); v kódu žádná změna.

## [0.02.049] – 2026-11-11

### Přidáno
- **Výřez každé fotky (Chytrý výřez náhledů, krok 1):** výpočet obsahu fotek v pozadí si u každé fotky uloží
  rámeček postavy a obličeje z detektoru (`obsah/vyrezy.bin` vedle partií, 9 B na fotku). Partie i výřez dává jeden
  běh detektoru; fotky spočítané dřív doběhnou jen detektorem (~27 ms na fotku, 23 000 fotek asi 10 minut
  v pozadí). Smazání obsahu fotek smaže i výřezy.
- `GetVyrezyFotek(ids)` (rámečky, zdroj postava / bez / čeká) a `GetStavVyrezu()` pro další kroky; náhledy je
  začnou používat v 0.02.050.

### Ověřeno
- Na 300 náhledech ze sbírky: postava nalezena u 294, obličej u 284; rámečky zakreslené do náhledů sedí (i fotka
  na šířku s ležící modelkou).
- Schéma databáze a export beze změny (ruční výřez je samostatný krok 0.02.052 **[schéma] [export]**).

## [0.02.048] – 2026-11-11

### Opraveno
- **Prohlížeč PDF byl průhledný:** okno mělo pozadí z neexistující proměnné `--bg-body`, takže přes něj prosvítal
  program a lišta PDF se překrývala s jeho navigací. Teď má tmavé pozadí programu.

### Zrychleno
- **Otevření PDF:** rozměry všech stran se vyžádají od workeru pdf.js naráz, ne jedna po druhé. 200stránkové číslo
  (21 MB, stránky jako skeny) se ve snímkovači otevře za 1,6 s místo 2,6 s (požadavek do 5 s).

### Ověřeno
- Ve WebKitGTK 2.54 (snímkovač, úloha `nastroje/snimky/pdf.json`, PDF z proměnné `PDF` místo dialogu): worker pdf.js
  (`.mjs`) se načte, náhledy stran se kreslí jen viditelné (7 po otevření, po skoku na konec dalších 7),
  listování dvoustranou a skok na poslední stranu fungují.
- Etapa Ladění (0.02.037–0.02.048) je hotová; další je Chytrý výřez náhledů.

## [0.02.047] – 2026-11-11

### Zrychleno
- **Galerie:** řady kolekcí si pamatují, které fotky do kolekce patří (podmínka přes ~23 000 fotek se vyhodnotí
  jednou za den a změnu sbírky). Opakované otevření Galerie: kolekce 150–390 ms → ~57 ms; první obsah Galerie
  na kopii sbírky po 0,22 s místo 0,62 s.
- **Kolekce Galerie v předpřípravě v klidu** (i po hodnocení, které mění otisk sbírky), nejen na úvodní obrazovce.
- **Profil:** kalendář pro odkazy `[[…]]` a kontext čísel se načte jednou (souběžná volání `GetKalendar` se slučují).

### Testy
- Výkonové testy (Kendallovo τ_b, trendy a zlomy, rozdíly výběru, Mapa sbírky) měří nejlepší z několika běhů po
  zahřátí (`test/mereni.js`); souběh testovacích souborů je už nezhazuje. Frontendové i výkonové testy Go prošly
  10× za sebou.
- Úloha snímkovače `nastroje/snimky/vykon.json` měří přepnutí pohledů: čas do vykreslení, změny DOM, volání
  backendu a zablokování hlavního vlákna.

### Zjištěno
- Volání backendu při otevření profilu trvají v Go dohromady 35–70 ms; zbytek čekání je vykreslování v okně.
  Snímkovač kreslí softwarově, takže časy kreslení velkých fotek z něj nejsou spolehlivé – změřit na skutečném
  počítači (⋯ › Nápověda › Přehled výkonu).

## [0.02.046] – 2026-11-11

### Opraveno
- **Hledání `casopis:` bere časopisy jako profil:** dřív jen z čísel alb a obálek. Modelka jen s textovým vydáním
  pictorialu (např. „1992-03@PH“) nebo s prázdným albem centerfoldu se v profilu ukázala v Penthouse, ale
  `casopis:ph` ji nenašlo. Teď se počítají i centerfoldy, textová vydání a online alba (Playboy), stejně jako
  v profilu, na kartě a v Síni slávy (`hledani.CislaKariery`).

### Ověřeno
- Test na vzorové sbírce s Playboyem, Penthouse a Hustlerem (`stejna_data_test.go`, `stejna-data.test.js`):
  stejné časopisy v hledání, profilu, kartě a Síni slávy; tituly (Playmate měsíce, Pet of the Month, Honey of the
  Month) stejně v kategoriích, štítcích profilu, Údržbě a modelce čísla v kalendáři.
- Statistiky výskytů zůstávají záměrně jen z Playboye (popsáno ve statistiky.js).

## [0.02.045] – 2026-11-11

### Opraveno
- **Údržba bere titul jen z galerií:** priorita úkolů a „… bez data narození“ už nečtou „Playmate“ z pole Role.
  Modelka s titulem je ta s centerfoldem nebo pictorialem modelky měsíce či roku kteréhokoli časopisu (Pet, Honey).
  Krátký titul je „Playmate“ jen u Playboye, jinak titul časopisu, bez titulu „Modelka“.
- **Kontrola Playmate roku** nepočítá centerfold Penthouse jako první centerfold Playboye.
- **Návrhy druhu alba** píšou titul z názvu alba („název alba uvádí Pet of the Month“, ne vždy Playmate) a u čísla
  jiného časopisu „pictorial modelky měsíce“; návrh čísla pictorialu píše „pictorial modelky“, ne „playmate“.

### Ověřeno
- Údržba (Dnes, Po údajích, Po modelkách) a Statistiky na snímcích 1280 a 1920 px (úloha
  `nastroje/snimky/udrzba.json`): nic za oknem, Pet nikde jako Playmate. Dlouhé texty nálezů se v řádku zkracují,
  celý text je v bublině.
- Snímkovací WebKit má dočasné úložiště, takže každý běh začíná v Profilech a nezůstane v posledním pohledu.

## [0.02.044] – 2026-11-11

### Opraveno
- **Síň slávy › volba časopisu nic nedělala:** kořen síně nese `data-sl-panel` a klik kamkoli v heru a liště se bral
  jako tlačítko panelu. Teď funguje volba časopisu, karty hera (Sezóna, Legendy, Odznaky, Rekordy) i filtr Kroniky.
- **Hero se zvoleným časopisem nikdy prázdný:** když jednička Top 10 není z časopisu, ukáže jeho nejvýš umístěnou
  modelku v Top 10, jinak nejvýš v pořadí, jinak nejvýš hodnocenou („Síň slávy · Penthouse · nejvýš v pořadí (224.)
  – Ilse Hasek“) i s velkou fotkou.
- **Časopisy modelky pro filtr** se berou jako nadtitulek profilu (i pictorialy čísel a online alba) – Carlye Denise
  (jednička, jen pictorial a online) patří do Playboye.
- **Karty pod herem Síně slávy** se dělí o šířku; při 1280 px se pátá karta (Rekordy) neusekávala za oknem.
- **Porovnat:** fotky v pásu vyplní výšku karty (pravidlo pásu čísla je zmenšovalo na 120 px a pod nimi zůstávalo
  prázdné místo); srdíčka nad názvem alba, ne přes něj.

### Ověřeno
- Síň slávy pro Všechny časopisy, Playboy a Penthouse, Porovnat, Hodnotit a Pořadí na snímcích 1280 a 1920 px
  (úloha `nastroje/snimky/hodnoceni.json`).

## [0.02.043] – 2026-11-11

### Opraveno
- **Hero Kalendáře a Obálek ukazuje, kdo je v čísle**, i když číslo nemá centerfold s fotkou: z centerfoldu zapsaného
  bez fotek, z alba s titulem měsíce, jinak z pictorialů jediné modelky. Penthouse 1969: „Listopad 1969 vyšlo před
  57 lety – Pet of the Month Ulla Lindstrom“ (dřív bez jména a s opakovaným „· Penthouse“); Obálky Leden 1975:
  „Playmate měsíce Lynnda Kimball“; Listopad 2012: „pictorial Leanna Decker“.
- **Stránka čísla Penthouse:** obsah, hlavička alba a nápověda pásu fotek píšou „Pet of the Month“, ne „Playmate měsíce“.
- **Centerfoldy:** řada bez fotek centerfoldu (Penthouse) ukáže „Penthouse: zatím žádný centerfold“, ne „Hledání ani
  filtrům neodpovídá“.

### Ověřeno
- Hero Kalendáře, Obálek a Centerfoldů pro Playboy i Penthouse a stránka čísla Listopad 1969 · Penthouse na snímcích
  1280 a 1920 px (úloha `nastroje/snimky/cisla.json`).

## [0.02.042] – 2026-11-11

### Opraveno
- **Karta modelky:** rok pod jménem (volba „rok na kartě“) je rok prvního vystoupení jako v nadtitulku profilu –
  i z online alb (Ali Rose 2014, dřív prázdné); u jiného časopisu než Playboy s jeho zkratkou v barvě časopisu
  („1969 PH“ u Ully Lindstrom), aby karta z Penthouse nevypadala jako Playboy.
- **Řazení Podle roku a části lišty (desetiletí)** berou rok stejně – modelky jen z Penthouse nebo jen online už
  nekončí v „Bez vydání“.
- **Našeptávač:** nadpis „Možnosti filtru Časopis“ místo „casopis“ (i u ostatních klíčů český název).

### Ověřeno
- Mřížka karet, hledání `casopis:penthouse` (3 karty s „PH“) a prázdný výsledek hledání na snímcích 1280 a 1920 px:
  nic nepřetéká.

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
