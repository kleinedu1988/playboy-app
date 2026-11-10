# Pinup Katalog – Roadmapa

Plán vývoje od přejmenování na Pinup Katalog. Do verze 1.53.0 se program jmenoval **Playboy Database**; jeho celý
plán a historie jsou v [docs/archiv/ROADMAP-PLAYBOY-DATABASE.md](docs/archiv/ROADMAP-PLAYBOY-DATABASE.md) a
[docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md](docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md). Odkazy „ROADMAP 1.xx“
v komentářích kódu a značka **PD 1.xx** níže míří do archivní roadmapy (verze Playboy Database), ne do nové řady.

**Stav (10. 11. 2026): verze 0.1.0** – program přejmenovaný, verzování začíná znovu. Všechno z Playboy Database
1.53.0 funguje dál; data se při prvním spuštění sama přesunou do nových složek. Další na řadě je 0.2 – Časopis
jako údaj čísla.

---

## Pravidlo verzování

Formát `MAJOR.MINOR.PATCH` (SemVer), jen čísla bez nul na začátku:

- **0.x.y – přechod na víc časopisů:** MINOR = krok přechodu z plánu níže, PATCH = dílčí krok nebo oprava.
- **1.0.0 – první vydání Pinup Katalogu:** přechod hotový (etapa U), ověřený na sbírce se dvěma časopisy.
- **1.x.y po 1.0:** MINOR = téma z plánu, PATCH = krok v tématu nebo oprava; MAJOR = velký milník.
- Kompatibilitu dat dál hlídá číslo úpravy schématu DB a verze exportu (`TestZmrazeniAlfy`), ne verze programu.
  Číslování úprav schématu a verzí exportu pokračuje z Playboy Database (nezačíná znovu).

Verze se drží synchronně v: `verze.go`, `wails.json`, `frontend/package.json`, `frontend/package-lock.json`,
`frontend/package.json.md5` a `CHANGELOG.md`. Kontrola nové verze (`aktualizace.go`) bere jen vzdálenou větev,
jejíž `verze.go` má `NazevProgramu` – starou řadu 1.x Playboy Database za novější nepovažuje.

---

## Přehled etap

| Etapa | Verze | Stav | Název | Hlavní přínos |
|---|---|---|---|---|
| PD | 0.1–1.53 | ✅ Hotovo | Playboy Database | Celý dosavadní program (archivní roadmapa) |
| **U** | **0.1–0.9** | 🚧 0.1 hotová | **Univerzální katalog** | Modelky v centru, časopis jen jako místo publikace: Playboy, Penthouse, Hustler… |
| **1.0** | **1.0.0** | 📋 Plán | **První vydání Pinup Katalogu** | Přechod ověřený na skutečné sbírce |
| **H** | **1.1** | 📋 Plán | **Prohlížení a časopis 2** | Zbytek etapy H z Playboy Database (PD 1.54) |
| **I** | **1.2–1.5** | 📋 Plán | **Sbírka výtisků** | PD 1.55–1.58 |
| **J** | **1.6–1.10** | ⏸ Odloženo | **Kvíz, průvodce číslem, Google Disk a světlý motiv** | PD 1.59–1.63 |

---

## Etapa U – Univerzální katalog (0.1–0.9)

**Cíl:** jedna modelka = jeden profil s celou kariérou, ať vyšla v Playboyi, Penthouse, Hustleru nebo jinde. Časopis
je nový údaj čísla vedle edice (edice = země vydání: US, CZ, UK…). Playboy zůstává výchozí, takže stávající data
se nemění a nic se nerozbije; každý krok je samostatně použitelný.

Výchozí stav (zjištěno 10. 11. 2026): vydání je text `RRRR-MM[-EDICE]` (`rozlozitVydani` v
`frontend/src/lib/format.js`), edici zná ~30 souborů a ~100 míst v Go, pojmy Playboye (Playmate, PMOY, centerfold)
jsou v kódu ~370× – většinou jen popisky. Řady čísel (`RADY_EDIC`, `NEVYSLA_CISLA`) a zdroje z webu (Wikidata,
Wikipedie, Boobpedia) jsou nastavené jen na Playboy.

#### 0.1 – Přejmenování a nové verzování ✅ (10. 11. 2026)

| # | Co | Jak |
|---|---|---|
| 1 | Název | Pinup Katalog v okně, nabídce aplikací, nápovědě, exportu; Go modul `pinup-katalog` |
| 2 | Přesun dat | `prejmenovani.go`: při prvním spuštění `~/.local/share/playboy-app` → `pinup-katalog` (včetně localStorage okna) a `~/.cache/playboy-app` → `pinup-katalog`; když běží stará verze nebo přesun selže, zůstává stará složka |
| 3 | Instalace | `instalovat.sh` instaluje `pinup-katalog` a odebere starý program z nabídky (data nechá) |
| 4 | Verzování | 0.1.0; starý plán a changelog archivované; kontrola nové verze nepovažuje starou řadu 1.x za novější; „Co je nového“ se po přechodu ukáže |

#### 0.2 – Časopis jako údaj čísla **[schéma]**

**Cíl:** program ví, ve kterém časopise číslo vyšlo; u Playboye se nic nemění.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Tabulka časopisů | `casopisy` (klíč `PB`, `PH`, `HU`…, název, krátký název, barva, název „modelky měsíce“ a „modelky roku“: Playmate / Pet of the Month / Honey, PMOY / Pet of the Year); Playboy, Penthouse a Hustler předvyplněné, další jde přidat | M |
| 2 | Klíč vydání | Rozšířit na `RRRR-MM[-EDICE][@ČASOPIS]`; bez `@` = Playboy, takže všechna stávající data platí beze změny; `rozlozitVydani` / `slozitVydani` a obdoba v Go vrací i časopis; testy na všechny tvary | M |
| 3 | Schéma a export | Ohlášená úprava schématu (`cisla`, `alba.vydani`, speciály) a nová verze exportu; import starších exportů = Playboy; `TestZmrazeniAlfy` | M |
| 4 | Zadávání | Výběr časopisu v okně čísla, alba a coveru (pamatuje si poslední); bez výběru Playboy | S |

**Hotovo, když:** jde zadat číslo Penthouse 09/1985 s Pet of the Month a stávající sbírka po převodu vypadá i počítá
se přesně jako před ním (porovnání zálohy před a po: žádný rozdíl).

#### 0.3 – Řady čísel a Mapa čísel pro každý časopis

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Řady čísel | `RADY_EDIC` → řady podle časopisu a edice (Penthouse US od 09/1969, UK od 1965, Hustler od 07/1974…), nevyšlá čísla a speciály zvlášť; data řad v jednom souboru, ne v kódu | S–M |
| 2 | Mapa čísel a Kalendář | Přepínač časopisu (a „vše“); úplnost a „mám / sháním“ podle časopisu; karty Přehledu pro každý sbíraný časopis | M |
| 3 | Hledání | `casopis:penthouse`, `pet`, `honey` v chytrém hledání (PD 1.36) a chytrých výběrech | S |

**Hotovo, když:** Mapa čísel ukáže úplnost Penthouse i Playboye zvlášť a `casopis:penthouse 80. léta` najde správné modelky.

#### 0.4 – Pojmy podle časopisu

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Role modelky v čísle | „Playmate měsíce / roku“ zobecnit na „modelka měsíce / roku“ s názvem z tabulky časopisů; centerfold, cover a pictorial zůstávají obecné | M |
| 2 | Texty rozhraní | Projít ~370 výskytů Playmate/PMOY/Playboy: obecný text, nebo název podle časopisu; nápověda a prázdné stavy | M |
| 3 | Síň slávy, sezóny, Rok ve sbírce | Fungují přes všechny časopisy, s filtrem časopisu | S–M |

**Hotovo, když:** v rozhraní není nikde „Playmate“ u modelky, která byla jen Pet of the Month.

#### 0.5 – Profil napříč časopisy a slučování modelek

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Kariéra v profilu | Časová osa a čísla modelky podle časopisů (barva časopisu), „Pet of the Month 1985 · Playmate 1987“ | S–M |
| 2 | Návrh sloučení | Úkol Údržby: stejné jméno / přezdívka + datum narození + vizuální podobnost (CLIP, PD 1.32–1.33) → návrh sloučit dva profily; sloučení s rozdílem nanečisto a Vrátit (PD 1.51.1); nikdy automaticky | M |
| 3 | Přezdívky | Modelky v jiných časopisech vystupovaly pod jiným jménem: více jmen u modelky, hledání podle všech | S |

**Hotovo, když:** modelka z Penthouse i Playboye má jeden profil s oběma čísly a návrh sloučení nenavrhne dvě různé
modelky se stejným jménem (ověřit na vzorku).

#### 0.6 – Fotky z PDF a z místních souborů **[rozhodnutí]**

**Rozhodnout předem:** fotky jsou dnes jen odkazy na Google Disk (Nedělat: místní kopie v plné velikosti). Stránky z PDF
potřebují buď nahrát na Disk (zůstává pravidlo), nebo nový druh zdroje „soubor na disku“ (změna pravidla).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Import čísla z PDF | Vybrat PDF, stránky jako náhledy (pdf.js v rozhraní, bez nové závislosti v Go), označit obálku, centerfold a stránky pictorialů a přiřadit je modelkám a albům | M–L |
| 2 | Uložení stránek | Podle rozhodnutí: export stránek do složky pro nahrání na Disk, nebo místní zdroj fotek se zálohou a kontrolou souborů (PD 1.42) | M |
| 3 | Rozpoznání | Návrh, kde začíná pictorial a kde je centerfold (rozložení stránky, obsah fotek PD 1.24) | S–M |

**Hotovo, když:** číslo Penthouse z PDF je za 10 minut v katalogu s obálkou, Pet of the Month a jejími fotkami.

#### 0.7 – Údaje z webu pro další časopisy

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Wikidata a Wikipedie | Seznamy Penthouse Pets a Hustler Honeys (Wikipedie, Wikidata „ocenění“) jako zdroj řad a návrhů údajů; jen na kliknutí s potvrzením (Rozhodnuto) | M |
| 2 | Zásobník odkazů | Rozpoznat odkazy z webů časopisů v zásobníku (PD 1.35) a předvyplnit časopis a číslo; přihlášení k placeným webům program nedělá a obsah za přihlášením nečte | S |

**Hotovo, když:** úplnost čísla (PD 1.38) funguje i pro Penthouse.

#### 0.8 – Vkus, odhady a Statistiky napříč časopisy

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Časopis jako vlastnost | Model vkusu, odhady, podobné modelky a Objevit (PD 1.53) s časopisem jako vlastností; Můj vkus v čase umí „víc ti teď sedí Penthouse“ | S–M |
| 2 | Statistiky | Filtr a barva podle časopisu ve všech grafech, srovnání časopisů (výška, období, styl), Mapa sbírky obarvená časopisem | M |

**Hotovo, když:** Statistiky ukážou průkazný rozdíl mezi časopisy, pokud v datech je.

#### 0.9 – Dotažení a beta

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Zbytky starého názvu | Názvy souborů `playboy.db` → `katalog.db` (s přesunem a zálohou), klíče v localStorage, export, kapesní katalog, ikona programu | S–M |
| 2 | Repozitář | Přejmenovat repozitář na GitHubu (přesměrování adres funguje), README, `instalovat.sh` | S |
| 3 | Beta | Používání se dvěma časopisy, opravy jen nalezených chyb; pak 1.0.0 | – |

---

## Plán po 1.0 (převzato z Playboy Database)

Nedokončená část plánu PD 1.54–PD 1.63, přečíslovaná. Kde se týká Playboye (Playmate, česká edice), při převzetí
zohlednit časopis z etapy U.

#### 1.1 – Prohlížení a časopis 2

**Cíl:** režim čtení (PD 1.41) a prohlížeč fotek použít na víc míst a lépe využít výřezy z PD 1.45.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Časopis z čehokoli | Režim čtení pro ročník, chytrý výběr, sezónu a Síň slávy (pořadí jako stránky) přes `otevritStrany` jako Rok ve sbírce (PD 1.46) | M |
| 2 | Dvoustrany podle výřezů | Rozvržení stran podle návrhu výřezu (PD 1.45), aby postava nebyla pod textem; dvě fotky na šířku vedle sebe | S–M |
| 3 | Dvě fotky vedle sebe | V prohlížeči porovnání dvou fotek se sdílenou lupou a posunem; z prohlížeče „Nastavit jako titulní / profilovou“ rovnou s návrhem výřezu | M |
| 4 | Návrh titulní a profilové | Pro modelky bez nich návrh z vkusu, kvality (PD 1.51) a výřezu (PD 1.45) jako úkol Údržby | S |

**Hotovo, když:** jde promítat libovolný chytrý výběr jako časopis a modelky bez titulní fotky mají návrh na jeden klik.

---

### Etapa I – Sbírka výtisků (1.2–1.5)

Česká edice se sbírá fyzicky (Rozhodnuto: výtisky jen u CZ; po přechodu rozhodnout, jestli i u dalších časopisů, např. Penthouse v PDF ne). Dnes program ví jen „mám / sháním“; tato etapa doplní,
v jakém stavu výtisk je, kolik stál a co jde vyměnit, a končí tiskovými sestavami (PD 1.57, přesunuto z PD 1.43) a burzou; kapesní katalog (PD 1.47) pak ukáže i stav výtisku.

#### 1.2 – Evidence výtisků české edice **[schéma]**

**Cíl:** u každého čísla české edice zapsat stav a původ výtisku tak rychle, jako se dnes přepíná „mám / sháním“.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Údaje výtisku | Stav (jako nový / velmi dobrý / dobrý / poškozený), chybí plakát nebo strany, počet kusů, cena, kde a kdy koupeno, poznámka; ohlášená úprava schématu č. 17 (tabulka `vytisky` s klíčem vydání) a export 14, převod ze sloupce `stav` beze ztráty | M |
| 2 | Rychlý zápis | V detailu čísla karta Výtisk, v Kalendáři klávesy pro stav; „Koupeno dnes za…“ jedním polem (cena a místo se pamatují z minula, našeptávač míst) | S–M |
| 3 | Hledání a filtry | Příkazy `vytisk:poškozený`, `cena:>200`, `koupeno:2026`, `kusu:>1`; čipy chytrého hledání (PD 1.36) a chytré výběry (PD 1.37) | S |

**Hotovo, když:** koupené číslo jde zapsat i se stavem a cenou do 10 s a hledání `vytisk:poškozený` najde výtisky k výměně za lepší.

#### 1.3 – Výdaje a hodnota sbírky

**Cíl:** vědět, kolik sbírka stála, kolik ještě bude stát a kde se nakupuje nejlépe.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Karta Výtisky ve Statistikách | Utraceno celkem a po letech nákupu, průměrná cena čísla podle ročníku vydání, místa nákupu s průměrnou cenou, nejdražší kusy; křivky s rozpětím (PD 1.34) | S–M |
| 2 | Odhad do kompletu | Kolik čísel chybí a odhad ceny zbytku z průměrů daného období (medián, ne průměr; málo dat = rozpětí); u ročníku „do kompletu chybí 3 čísla, asi 450 Kč“ | S |

**Hotovo, když:** Statistiky ukážou výdaje po letech a u každého neúplného ročníku odhad, kolik stojí ho dokončit.

#### 1.4 – Rozšířené tiskové sestavy (katalog chybějících čísel a kapesní seznam; přesunuto z PD 1.43)

**Cíl:** vylepšit tiskové výstupy pro reálné použití v terénu (antikvariáty, burzy): kapesní seznam sháněných čísel na jednu stránku A4 a tiskový arch ročníku s obálkami.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Kapesní seznam „Sháním“ na 1× A4 | Kompaktní vícesloupcový tiskový výstup všech chybějících a sháněných čísel CZ/US edice se zaškrtávacími políčky a poznámkou o Playmate měsíce | S |
| 2 | Tiskový přehled ročníku s obálkami | Přehledová stránka vybraného ročníku (12 obálek + Playmate měsíce + stav ve sbírce) optimalizovaná pro tisk do PDF | S |

**Hotovo, když:** z Časopisů nebo Mapy sbírky lze jedním klikem vytisknout kompaktní seznam sháněných čísel na jednu stránku.

#### 1.5 – Burza a výměny

**Cíl:** připravit se na burzu nebo inzerát jedním klikem: co nabízím (duplikáty, horší kusy) a co sháním.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Nabízím / Sháním | Seznam duplikátů (kusů > 1) a výtisků k výměně za lepší stav, vedle sháněných čísel; text ke zkopírování do inzerátu (prostý text i markdown) | S |
| 2 | Tisk pro burzu | Rozšíření kapesního seznamu z PD 1.57 o sloupec „nabízím“ a cenový strop u sháněných čísel | S |

**Hotovo, když:** jedním klikem vznikne text inzerátu „Nabízím / Sháním“ a tiskový arch na burzu.

---

### Etapa J – Odložené: Kvíz, průvodce číslem, Google Disk a světlý motiv (1.6–1.10)

Na přání uživatele odložené na konec plánu (kvíz z PD 1.43, průvodce číslem z PD 1.36 a PD 1.38, Google Disk z PD 1.38–PD 1.39); vkládání z Disku stojí na prohlížeči Disku, proto jdou spolu.

#### 1.6 – Kvíz „Poznej modelku“ (odloženo z PD 1.43)

**Cíl:** odlehčená znalostní hra nad vlastní sbírkou přímo v aplikaci (statistiky a Leitnerovy krabičky uložené v `nastaveni`, bez změny schématu DB).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Hra „Kdo je to?“ a „Který rok / číslo?“ | Titulní fotka nebo obálka a 4 možnosti (lehká = náhodné, těžká = podobné modelky ze stejného desetiletí), ovládání klávesami `1`–`4`, `Enter`, `Esc` | M |
| 2 | Skóre, série a opakování chyb | Evidence úspěšnosti a nejdelší série v `nastaveni`, po hře přehled chyb s proklikem na profil, častější zařazování modelek, které uživatel plete | S |

**Hotovo, když:** deset otázek lze odehrát čistě z klávesnice, po hře se zobrazí přehled chyb s proklikem na profily a statistiky přežijí restart.

#### 1.7 – Průvodce přidáním celého čísla (odloženo z PD 1.36 a PD 1.38)

**Cíl:** přidat celé číslo časopisu (obálka, Playmate měsíce, další modelky na obálce a v čísle, rozhovor, fotky) v jednom souvislém průvodci se živou kontrolou úplnosti a tlačítkem „Vrátit přidání“.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Průvodce číslem | Kroky: 1. Základ a obálka → 2. Playmate měsíce (výběr existující nebo inline vytvoření nové) → 3. Další modelky a rozhovor → 4. Shrnutí s kontrolou úplnosti | M–L |
| 2 | Odhad dalšího chybějícího čísla | Tlačítko „+ Přidat další chybějící“ v Časopisech a v Mapě sbírky rovnou předvyplní nejbližší chybějící měsíc a rok | S |
| 3 | Cílené „Vrátit přidání“ | Po uložení průvodce lišta s možností vrátit celé právě přidané číslo (včetně nově vytvořených záznamů z tohoto kroku) | M |

**Hotovo, když:** celé číslo s obálkou, Playmate měsíce, rozhovorem a fotkami vznikne v jednom okně bez překlikávání a lze ho jedním klikem vrátit.

#### 1.8 – Google Disk v aplikaci (OAuth 2.0 + prohlížeč složek)

**Cíl:** volitelné přihlášení ke Google Disku (`golang.org/x/oauth2`, rozsah `drive.readonly` / `drive.file`) s prohlížením vlastní složky Playboy přímo v okně programu, bez nutnosti ručně kopírovat odkazy z prohlížeče. Návrh v [NAVRH-GOOGLE-DISK.md](docs/NAVRH-GOOGLE-DISK.md).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Přihlášení a správa přístupu | OAuth 2.0 se systémovým prohlížečem a návratem na `127.0.0.1`, uložení tokenu s právy `0600`, kořenová složka a odhlášení v Nastavení | M |
| 2 | Prohlížeč složek a fotek | Strom složek, drobečková cesta, hledání složky, mřížka náhledů s indikací „už je v databázi“ | M |

**Hotovo, když:** přihlášený uživatel vidí své složky na Disku přímo v programu a pozná, které fotky už v databázi jsou.

#### 1.9 – Vkládání fotek a obálek přímo z Disku

**Cíl:** napojit prohlížeč Google Disku (PD 1.61) na zásobník fotek v detailu modelky, na obálku čísla a na hromadný import složky.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Výběr pro modelku a obálku | Tlačítko „Vybrat z Disku…“ u fotek modelky, v průvodci číslem a u obálky; automatické předvyplnění hledání jménem modelky nebo číslem vydání | M |
| 2 | Chytré zařazení celé složky | Načtení složky s návrhem rozdělení (1. fotka = obálka / titulní, další = běžné fotky), přeskočení již evidovaných fotek | S–M |

**Hotovo, když:** fotky celé modelky nebo čísla lze vybrat z Disku v jednom okně bez kopírování URL adres.

#### 1.10 – Světlý motiv a kontrast (odloženo z PD 1.50, 10. 11. 2026)

**Cíl:** volitelný světlý motiv pro práci ve dne a vyšší kontrast, se stejným růžovým akcentem.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Barvy jen přes proměnné | Převést ~740 natvrdo zapsaných barev ve `style.css` na proměnné (`--povrch-*`, `--text-*`, `--cara-*`, `--stin-*`); test, který hlídá, aby nové natvrdo zapsané barvy nepřibývaly | M–L |
| 2 | Světlý motiv | Tmavý (výchozí) / Světlý / Podle systému (`prefers-color-scheme`); růžový akcent s ověřeným kontrastem 4,5 : 1 na obou pozadích, zlaté prvky (`--zlato-*`) se pro světlé pozadí jen ztmaví; prohlížeč fotek, režim čtení a promítání zůstávají vždy tmavé | M |
| 3 | Vyšší kontrast | Silnější tlumený text, okraje a tlustší rámeček fokusu; navazuje na popisky pro čtečku (R18) | S |

**Hotovo, když:** všechny pohledy ve světlém motivu projdou kontrolou kontrastu WCAG AA a motiv se přepne bez restartu.

---

## Rozhodnuto

- Album jako záznam (0.10.0); řazení galerie abecedně, naposledy přidané, rok prvního vydání; speciály zvlášť;
  národní edice US a CZ (0.13.0).
- Výtisky se sbírají jen u české edice (mám výtisk, sháním); americká edice je archiv dat (0.34.2). Česká edice
  začíná číslem 07/2011 (0.51.6).
- Měsíční řady edic (`RADY_EDIC` v `frontend/src/lib/format.js`, 0.51.8): americká od 12/1953 do 03/2020 (Spring 2020,
  poslední pravidelné číslo), od 2025 ročenka a čtvrtletník evidované jako speciály; česká od 07/2011. Jednotlivá
  čísla, která nevyšla, jsou v `NEVYSLA_CISLA` (americké z března 1955, 0.51.7).
- Dvě modelky stejného jména se liší datem narození; data narození a úmrtí RRRR, RRRR-MM nebo RRRR-MM-DD;
  hodnota „-“ v importu údaj smaže; překlep v klíči souboru se opraví na nejbližší známý klíč (0.18.0–0.30.0).
- Vzhled: střídmý, jeden růžový akcent a decentní zlatá jako doplněk (proměnné `--zlato-*`, např. lem záhlaví profilu;
  ne jako druhý akcent tlačítek a voleb), písmo aplikace i v nadpisech (patkové písmo vráceno v 0.34.1; výjimkou
  je režim čtení PD 1.41). Potvrzeno 10. 11. 2026 při plánu etapy G.
- Google Disk: zobrazování zůstává přes sdílené odkazy, Google API přibude jen pro výběr fotek v programu (PD 1.61–PD 1.62).
- Malé náhledy smí program ukládat na disk jako mezipaměť (PD 1.6); originály a velké fotky zůstávají jen na Disku.
- 1.0.0 po 14 dnech používání bety bez nové chyby (21. 10. 2026); po 1.0.0 MINOR pro téma z plánu, PATCH pro
  každý krok a opravu v tématu; MAJOR = velký milník, kompatibilitu dat hlídá verze schématu a exportu.
- Editor textů (PD 1.40): vlastní lišta nad markdownem s náhledem, žádná knihovna editoru.
- Wikidata, Wikipedie a Boobpedia (PD 1.38) jen na kliknutí a s potvrzením každého údaje; Babepedia ani jiné weby bez API se nečtou.

- **Přejmenování (10. 11. 2026):** Pinup Katalog; modelka je hlavní, časopis je údaj čísla vedle edice (země),
  výchozí Playboy; jedna modelka napříč časopisy = jeden profil (sloučení jen s potvrzením); verzování znovu od 0.1.0.

## Nedělat

- Obecné Zpět pro všechny úpravy (deník změn) – denní zálohy, Vrátit u fotek a Vrátit přidání čísla stačí.
- Místní kopie fotek v plné velikosti (malé náhledy jako mezipaměť ano, viz PD 1.6), zálohy na jiný disk.
- Šifrovanou databázi – zvolen zámek rozhraní.
- Půlsrdíčka.
- Zobrazování fotek přes Google API s přihlášením (API jen k výběru fotek); automatický import celé
  složky bez výběru, automatické stahování a zápis údajů z webu bez potvrzení (Wikidata jen na kliknutí
  a s potvrzením každého údaje), rozpoznávání obličejů.
- Nové funkce v alfě a betě a neohlášené změny schématu nebo exportu (`TestZmrazeniAlfy`).
- Vše z oddílu „Rozhodnuto nedělat“ v `PLAN.md`.
