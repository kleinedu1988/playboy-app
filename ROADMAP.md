# Roadmapa

Stav k 19. 10. 2026, verze **0.51.0 – alfa**. Hotové změny jsou v `CHANGELOG.md`, drobné nápady a rozhodnutí
v `PLAN.md`. Předchozí podoby roadmapy jsou v historii gitu (etapy 0–6 ve značce `v0.9.0`, etapy 7–10
ve verzi 0.34.7).

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc.

## Kde jsme

Etapy 7–10 (opravy po auditu, pevné schéma, rozhraní na dlouhou trať, příprava k vydání) jsou hotové.
Mezi verzemi 0.14 a 0.34 navíc přibylo víc, než původní plán počítal:

- import YAML i Markdownu, formát exportu verze 7 (`EXPORT.md`, `vzor-exportu.yaml`),
- čísla časopisu jako plnohodnotné stránky: obsah podle stran, články, skeny stran, speciály, edice US a CZ,
- fulltextové hledání v článcích a textech alb (SQLite FTS5), cílené hledání, rozsahy, vylučování,
  tolerance překlepů a našeptávání, stejné ve všech přehledech,
- nový Přehled: mapy edic, Údržba jako fronta úkolů, Sháním CZ, Statistiky a vývoj modelek v čase,
- sjednocené rozhraní: lišta voleb s filtry, skleněné panely, prázdné stavy, kostry při načítání,
  přehled klávesových zkratek, jednotné kontextové nabídky.

Z původních etap 13 a 14 je hotové: Ctrl+F do hledání, seznam „Sháním“ ke zkopírování, hledání v kalendáři,
přepínač řazení galerie, naposledy přidané modelky na úvodu Přehledu a rozbory sbírky ve Statistikách.

## Číslování do 1.0.0

| Fáze | Verze | Co se smí měnit |
|---|---|---|
| Alfa | 0.5x | opravy, doladění rozhraní a zrychlení (MINOR pro větší zásah, PATCH pro opravy); schéma (úprava č. 11) a export (verze 7) zmrazené |
| Beta | 0.90.x | jen opravy chyb; zmrazené i funkce a texty |
| Vydání | 1.0.0 | jen číslo verze, datum v changelogu a značka |

Od 1.0.0 platí sémantické verzování naplno: změna schématu nebo exportu, která by starší verzi rozbila,
znamená 2.0.0. Zmrazení hlídá test `TestZmrazeniAlfy`; kdyby se v alfě ukázala nutná změna schématu nebo
exportu, je to vědomé rozhodnutí s novou MINOR verzí a úpravou testu, ne tichá oprava.

## Etapa 11 – Alfa (0.5x) – probíhá

Cíl: program používat na skutečné sbírce; vše, co se najde, je oprava.

| Co | Proč | Prac. |
|---|---|---|
| ~~Zmrazení schématu a exportu testem, popis v README a `EXPORT.md`~~ – hotovo v 0.50.0 | Pojistka proti nechtěné změně | S |
| ~~Rychlejší databáze: režim WAL, čtení po albech místo po fotkách~~ – hotovo v 0.51.0 | Zápis čekal na disk, Přehled a kalendář procházely všechny fotky | M |
| Používání na skutečné sbírce (v kopii), zápis chyb do `PLAN.md` a jejich oprava v dalších verzích 0.5x | Chyby, které testy nenajdou | M |
| ~~Poblikávání okna ve WebKitGTK: ověřit opravu z 0.33.18 na Fedoře~~ – ověřeno 20. 10. 2026 (spolu s WAL a postupným načítáním z 0.51.x) | Hlášené poblikávání | S |
| ~~Zátěžová zkouška na syntetické sbírce (2 000 modelek, 64 000 fotek): databáze i rozhraní~~ – hotovo v 0.51.9 (Nejlepší po dávkách, karty a plakáty mimo okno se nevykreslují) | Velká sbírka před betou | S–M |
| Audit kódu agenty (data, rozhraní, výkon) a oprava nálezů | Stejně jako po 0.9.0 | M |
| ~~Úzké okno a klávesnice: projít všechny pohledy a okna~~ – hotovo v 0.51.10 (Přehled v úzkém okně, mapy edic a Vývoj v čase klávesnicí, fokus po přechodu a Zpět, srdíčka klávesami) | Dojem z každodenního používání | S |

## Etapa 11b – Příprava bety (0.5x) – probíhá

Cíl: ověřit všechno, co chrání data, a uklidit před zmrazením. Mezitím se aplikace používá na skutečné sbírce
a nálezy jdou do `PLAN.md`. Pořadí: nejdřív data, texty a úklid nakonec, aby je už nic nerozbilo.

| # | Co | Proč | Prac. |
|---|---|---|---|
| 1 | ~~Přechod databáze ze všech dřívějších schémat (0.4 až dnes) a import exportů verzí 1–7; export → import tam a zpět na velké sbírce~~ – hotovo 20. 10. 2026: databáze a exporty deseti starých verzí (vytvořené těmi verzemi z gitu) jsou v `testdata/stare-verze` a test `TestPrechodZeStarychVerzi` je převezme beze ztráty; kruh export → import s 2 000 modelkami a 64 000 fotkami bez rozdílu | Nikdo nesmí přijít o data aktualizací ani zálohou přes export | S–M |
| 2 | ~~Zálohy v krajních situacích: obnovení velké databáze, poškozený soubor, heslo, plný disk; místo na disku~~ – hotovo 20. 10. 2026 (0.51.11): záloha 2 000 modelek 0,06 s a 8,9 MB, obnovení 0,2 s, poškozená záloha se pozná a neobnoví, bez možnosti zálohy se nic nesmaže ani neimportuje; nedokončená záloha se smaže | Záloha je poslední pojistka | S–M |
| 3 | ~~Revize zabezpečení: text z importu a formulářů vložený do stránky bez ošetření, uložení hesla~~ – hotovo 20. 10. 2026 (0.51.12): žádná zranitelnost; zkouška s útočným textem ve všech údajích nic nespustila, odkazy jen https, heslo PBKDF2 se solí, dotazy do databáze s parametry. Zbývá zvážit Content-Security-Policy (ověřit na Fedoře) | Import cizího souboru nesmí spustit kód | S |
| 4 | ~~Odolnost bez internetu a s chybějícími soubory na Disku, se špatnou adresou obrázků~~ – hotovo 20. 10. 2026 (0.51.13): výpadek sítě se při kontrole souborů počítá jako „neověřeno“, ne „nedostupné“; špatnou adresu obrázků program nepřijme; nenačtená fotka ukazuje „Nenačteno“ (ne „Bez fotky“), výpadek a návrat připojení se ohlásí a fotky se pak načtou samy | Aplikace se nesmí zaseknout ani mást hláškami | S |
| 5 | ~~Závislosti Go a JavaScriptu: známé zranitelnosti, aktualizace~~ – hotovo 20. 10. 2026 (0.51.14): npm audit bez nálezů (za běhu žádná knihovna z npm), opravné verze golang.org/x/net, sys, text, crypto a dalších, Go 1.26.10 jako `toolchain`, TypeScript 5.9; Wails zůstává 2.16.0 (2.17.0 až po betě s ověřením na Fedoře). govulncheck tu nemá přístup ke své databázi | Po betě už jen opravy | S |
| 6 | ~~Úklid: nepoužívaný kód a styly, `build/README.md` od Wails~~ – hotovo 20. 10. 2026 (0.51.15): 61 nepoužívaných pravidel stylů (staré karty Údržby, tabulky statistik, dřívější Přehled; snímky všech pohledů před a po beze změny), nepoužívané funkce v Go a v rozhraní (funkce backendu bez využití v rozhraní zůstávají, mají testy) | Méně míst pro chyby | S |
| ~~7~~ | ~~Texty a nápověda ve všech oknech a hláškách; „Co je nového“ jako souhrn pro betu (podrobnosti zůstanou v `CHANGELOG.md`); rychlost startu s velkou sbírkou~~ | Hotovo (0.51.16–0.51.17): opravené překlepy, zastaralé popisy a nejednotné názvy; „Co je nového“ sbalí starší verze; start s 2000 modelkami 0,13 s | S–M |
| ~~8~~ | ~~Instalace podle README a `instalovat.sh` krok za krokem (co jde ověřit bez Fedory; na čistém účtu ověří uživatel)~~ | Hotovo (0.51.18): z čistého klonu s prázdnou domovskou složkou projde sestavení, instalace, první spuštění i odinstalace; README má postup pro čistou Fedoru, skript vypíše, co chybí. Na čisté Fedoře ověří uživatel | S |

## Etapa 12 – Beta (0.90.x)

Cíl: nic nového, jen jistota. Beta 0.90.0 se vydá po etapě 11b.

| Co | Proč | Prac. |
|---|---|---|
| Instalace na čistém uživatelském účtu Fedory podle README, přenos dat na jiný počítač, obnovení ze zálohy | Ověřit na skutečném systému, že postupy v README fungují | S |
| Závěrečné opravy z používání (0.90.1…) | Dojem z vydané verze | S |

**Testovací scénář bety** (odškrtává uživatel na Fedoře; co selže, jde do `PLAN.md` mezi chyby):

- [ ] Před testem: ⋯ → Exportovat sbírku (YAML) a kopie složky `~/.local/share/playboy-app`
- [ ] Čistý uživatelský účet: postup „Poprvé na čisté Fedoře“ z README projde bez dalších zásahů
- [ ] Po instalaci ukáže `git status` čistý stav
- [ ] Program je v nabídce aplikací s ikonou, ikona je i v Alt+Tab; okno není prázdné (Content-Security-Policy)
- [ ] První spuštění ukáže úvod prázdné sbírky; import exportu z hlavního účtu projde
- [ ] Přenos dat: zkopírovaná složka dat na novém účtu – sbírka i heslo fungují
- [ ] Obnovení ze zálohy: ⋯ → Obnovit ze zálohy…, potom vrácení obnovení (záloha „Před obnovením“)
- [ ] Bez připojení: hláška o výpadku, po připojení se fotky načtou samy
- [ ] Na hlavní sbírce: verze 0.51.17–0.51.21 (texty, hlášky, ikona) bez chyby
- [ ] `./instalovat.sh --odinstalovat` odebere program, data zůstanou

## Po 1.0.0

### 1.1 – Google Disk v aplikaci

Cíl: fotky vybírat přímo z Disku v programu místo kopírování odkazů. Google API slouží jen k přidávání;
zobrazování zůstává na dnešní adrese obrázků (`lh3.googleusercontent.com/d/{id}`) bez přihlášení, takže
vypršené přihlášení prohlížení sbírky neomezí. Do databáze se dál ukládá jen ID souboru: schéma ani
formát exportu se nemění, token se uloží do tabulky nastavení. Dvojí jištění: kdyby Google adresu `lh3`
vypnul, zobrazování se přepne na oficiální náhledy z API.

| Co | Proč | Prac. |
|---|---|---|
| Přihlášení Googlem pro desktopovou aplikaci (prohlížeč, zpětná adresa na 127.0.0.1, PKCE), uložení a obnova tokenu, odhlášení; návod na založení vlastního projektu v Google Cloud v README | Bez přihlášení API nefunguje; aplikace v testovacím režimu, přihlášení vyprší po 7 dnech | M |
| Okno „Vybrat z Disku“: složky, náhledy (načtené přes program s tokenem), výběr více fotek, hledání podle názvu | Dnes se odkazy kopírují ručně jeden po druhém | L |
| Napojení do okna alba, coveru, titulní fotky a skenů článku; vkládání odkazů zůstává jako druhá cesta | Jeden výběr pro všechna místa, kde se přidávají fotky | S–M |
| Volba „Nasdílet vybrané soubory: kdokoli s odkazem“ (zaškrtávací, ne potichu) | Nenasdílená fotka se dnes nenačte a nikdo neví proč | S |
| Záložní zobrazování přes náhledy z API, když adresa `lh3` přestane fungovat (přepnutí v ⋯ → Adresa obrázků) | Adresa `lh3` není oficiálně zdokumentovaná | S–M |

### 1.2 – Každodenní práce

| Co | Proč | Prac. |
|---|---|---|
| Upozornění, že fotka už ve sbírce je u jiné modelky nebo v jiném albu | Duplicity napříč sbírkou program nehlídá | S |
| Pohled „Naposledy přidané“ po dnech (modelky, alba, fotky) | Navázat, kde jsem včera skončil | S |
| Automatické zamčení po nečinnosti | Okno nechané otevřené zůstává přístupné | S |
| Předchozí a další rok na stránce ročníku | Listování ročníky bez návratu do kalendáře | S |
| Evidence „mám PDF“ u americké edice (jen pokud se ukáže potřeba) | US se nesbírá fyzicky, archiv je v PDF | S [schéma] |

### 1.3 – Velká sbírka

| Co | Proč | Prac. |
|---|---|---|
| Rozšířené kontroly v Údržbě: centerfold bez data narození, cover bez modelky z obálky, stejný fotograf zapsaný různě | Kvalita dat ve velkém | M |
| Seznam fotografů k procházení | Stránka fotografa jde otevřít jen z alba | S |
| Rekordy ve Statistikách (nejmladší, nejvyšší, nejvíc obálek…) | Encyklopedický pohled | S |
| Titulní fotka alba pro stránky fotografa a ročníku | Hezčí přehledy alb mimo profil | S–M |
| Náhledy na disku: malé náhledy (karty, dlaždice, plakáty na stěně, ~30–60 kB) si program uloží natrvalo do `~/.cache/playboy-app`, velké fotky v prohlížeči se dál stahují; omezení velikosti, úklid náhledů smazaných fotek, „Vymazat náhledy“ v ⋯ | Mřížky se při rolování načítají okamžitě a fungují i bez internetu; mezipaměť WebKitu platí jen tak dlouho, jak určí Google | M |

### 1.4 – Editor textů

Cíl: pohodlné psaní článků, rozhovorů, textů alb a poznámek bez ručního psaní formátovacích značek.

| Co | Proč | Prac. |
|---|---|---|
| Editor s nástrojovou lištou (tučné, kurzíva, nadpisy, odrážky, citace) a živým náhledem | Dnes prosté pole, značky se píší zpaměti | M |
| Klávesové zkratky (Ctrl+B, Ctrl+I…), zvětšení na celé okno | Dlouhé texty | S–M |
| Šablony pro rozhovory (mluvčí `PLAYBOY:` / `Jméno:`, perex, citace) | Rychlejší přepis rozhovorů | S–M |
| Jeden editor pro články, alba, poznámky modelek i čísel | Jednotné chování | S–M |

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
- Vzhled: střídmý, jeden růžový akcent, písmo aplikace i v nadpisech (patkové písmo vráceno v 0.34.1).
- Google Disk: zobrazování zůstává přes sdílené odkazy, Google API přibude jen pro výběr fotek v programu (1.1).
- Malé náhledy smí program ukládat na disk jako mezipaměť (1.3); originály a velké fotky zůstávají jen na Disku.

## Nedělat

- Obecné Zpět pro všechny úpravy (deník změn) – denní zálohy a Vrátit u fotek stačí.
- Místní kopie fotek v plné velikosti (malé náhledy jako mezipaměť ano, viz 1.3), zálohy na jiný disk.
- Šifrovanou databázi – zvolen zámek rozhraní.
- Půlsrdíčka.
- Zobrazování fotek přes Google API s přihlášením (API jen k výběru fotek, viz 1.1); automatický import celé
  složky bez výběru, stahování údajů z webu, rozpoznávání obličejů.
- Nové funkce v alfě a betě a změny schématu nebo exportu od alfy.
- Vše z oddílu „Rozhodnuto nedělat“ v `PLAN.md`.
