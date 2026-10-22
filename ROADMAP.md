# Roadmapa

Stav k 21. 10. 2026, verze **0.90.0 – beta**. Hotové změny jsou v `CHANGELOG.md`, drobné nápady a rozhodnutí
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

## Etapa 11 – Alfa (0.5x) – hotovo

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

## Etapa 11b – Příprava bety (0.5x) – hotovo

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

## Etapa 12 – Beta (0.90.x) – probíhá

Cíl: nic nového, jen jistota. Beta 0.90.0 vyšla 21. 10. 2026.

| Co | Proč | Prac. |
|---|---|---|
| ~~Instalace na čistém uživatelském účtu Fedory podle README, přenos dat na jiný počítač, obnovení ze zálohy~~ – hotovo 21. 10. 2026, ověřeno uživatelem podle scénáře níže | Ověřit na skutečném systému, že postupy v README fungují | S |
| Závěrečné opravy z používání (0.90.1…) | Dojem z vydané verze | S |

**Testovací scénář bety** (odškrtává uživatel na Fedoře; co selže, jde do `PLAN.md` mezi chyby):

- [x] Před testem: ⋯ → Exportovat sbírku (YAML) a kopie složky `~/.local/share/playboy-app`
- [x] Čistý uživatelský účet: postup „Poprvé na čisté Fedoře“ z README projde bez dalších zásahů
- [x] Po instalaci ukáže `git status` čistý stav
- [x] Program je v nabídce aplikací s ikonou, ikona je i v Alt+Tab; okno není prázdné (Content-Security-Policy)
- [x] První spuštění ukáže úvod prázdné sbírky; import exportu z hlavního účtu projde
- [x] Přenos dat: zkopírovaná složka dat na novém účtu – sbírka i heslo fungují
- [x] Obnovení ze zálohy: ⋯ → Obnovit ze zálohy…, potom vrácení obnovení (záloha „Před obnovením“)
- [x] Bez připojení: hláška o výpadku, po připojení se fotky načtou samy
- [x] Na hlavní sbírce: verze 0.51.17–0.51.21 (texty, hlášky, ikona) bez chyby
- [x] `./instalovat.sh --odinstalovat` odebere program, data zůstanou

## Etapa 13 – Vydání 1.0.0

**Výjimka z bety:** kategorie modelek (0.91.0), lišta Přehledu nahoře a přepracované Statistiky s výběrem
modelek po kliknutí (0.92.x) výskyt modelky v časopise nebo jen online (0.93.0) a spojení Čísel s Kalendářem (0.94.0) přibyly 22. 10. 2026 na přání uživatele ještě před 1.0; schéma ani formát exportu
se nezměnily. Lhůta níže proto běží od jejich vydání: nejdřív 5. 11. 2026.

**Pravidlo:** 1.0.0 vyjde po **14 dnech běžného používání bety bez nové chyby**. Lhůta běží od vydání bety
(21. 10. 2026); každá nová chyba zapsaná v `PLAN.md` (oddíl „Chyby z bety“) ji po opravě spustí znovu od
vydání opravy. Změny jen v dokumentaci lhůtu neruší.
Kosmetickou drobnost (vzhled, text), která nebrání práci, smí uživatel vědomě odložit do 1.0.1 – lhůtu pak
neruší. Nejdřív možné vydání: 5. 11. 2026 (po kategoriích v 0.91.0), pokud se do té doby nic nenajde.

| Krok | Co |
|---|---|
| 1 | Kontrola: oddíl „Chyby z bety“ v `PLAN.md` je prázdný, 14 dní od poslední opravy uplynulo |
| 2 | Číslo 1.0.0 ve všech souborech verze, oddíl v `CHANGELOG.md` s datem a krátkým shrnutím (bez nových změn) |
| 3 | README: stav „vydáno (1.x)“, ROADMAP: etapa 12 a 13 hotové, další je 1.1 |
| 4 | Značka `v1.0.0` (pushne uživatel) |

## Po 1.0.0

### Jak se vydává po 1.0.0

- **Číslování:** MAJOR.MINOR.PATCH. MINOR = téma z plánu níže (1.1, 1.2 … po 1.9 následuje 1.10, ne 2.0).
  PATCH = pořadí kroku nebo opravy v tématu: první hotový krok vyjde jako 1.3.0, další jako 1.3.1, 1.3.2…
  a opravy pokračují stejnou řadou (stejně jako v alfě 0.51.0, 0.51.1…). Každá vydaná verze je funkční
  a projde všemi testy; když je hotový poslední krok tématu, vyzkouší ho uživatel na skutečné sbírce.
- **Data:** rozšíření schématu nebo exportu (nový sloupec, nový nepovinný údaj v exportu) je MINOR s novou
  úpravou schématu a novou verzí exportu; starší program novější databázi otevře jen pro čtení a novější
  export odmítne se srozumitelnou hláškou (obojí už umí). Změna nebo odebrání údaje, kvůli kterému by
  starší export nešel načíst, je MAJOR (2.0.0) a dělá se jen výjimečně.
- **Údržba (průběžně, jako PATCH):** Wails 2.17.0 (s ověřením na Fedoře: okno, nabídky, poblikávání),
  aktualizace Go a knihoven, `govulncheck` u uživatele.
- U každé verze: kroky v pořadí, ve kterém se dělají; **[schéma]** = mění databázi nebo export.

Každá verze níže je malá a ucelená (zhruba 1–3 dny práce, 2–4 kroky) a dá se vyzkoušet sama o sobě.
Pořadí verzí jde změnit, závislosti jsou uvedené.

| Verze | Obsah | Závisí na |
|---|---|---|
| 1.1 | Google Disk I – přihlášení a výběr fotek do alba | – |
| 1.2 | Google Disk II – výběr všude, nasdílení, záložní adresa obrázků | 1.1 |
| 1.3 | Rychlé drobnosti – duplicity, zamčení po nečinnosti, listování ročníky | – |
| 1.4 | Přehledy – Naposledy přidané, fotografové, rekordy | – |
| 1.5 | Náhledy na disku | – |
| 1.6 | Kvalita dat – nové kontroly v Údržbě, titulní fotka alba **[schéma]** | – |
| 1.7 | Editor I – lišta, náhled, zkratky | – |
| 1.8 | Editor II – rozhovory, jeden editor všude | 1.7 |
| rezerva | Hodnocení kolečkem myši, „mám PDF“ u americké edice **[schéma]** – jen když se ukáže potřeba | – |

### 1.1 – Google Disk I: přihlášení a výběr do alba

**Cíl:** fotky do alba přidávat výběrem z Disku přímo v programu místo kopírování odkazů (výběr na dalších
místech a nasdílení přijdou v 1.2). Prohlížení sbírky se nemění: fotky se dál zobrazují přes sdílené odkazy bez
přihlášení, takže odhlášení nebo vypršené přihlášení nikdy nezablokuje prohlížení. **Bez změny schématu
i exportu** – do databáze se dál ukládá jen ID souboru. Přihlašovací token se ukládá mimo databázi do
`~/.config/playboy-app/google.json` (práva jen pro uživatele), takže se nedostane do záloh, exportu ani
při přenosu složky dat na jiný počítač (tam se přihlásí znovu).

**Rozhodnutí před začátkem (doporučení tučně):**

| Otázka | Varianty | Proč |
|---|---|---|
| Rozsah přístupu k Disku | **`drive.file`** (jen soubory, které uživatel sám vybere ve výběru Google) / `drive.readonly` (čtení celého Disku, vlastní okno se složkami v programu) | `drive.file` je nejmenší přístup a Google ho řadí mezi necitlivé: aplikace jde přepnout do produkčního režimu bez ověřování Googlem a přihlášení nevyprší po 7 dnech. `drive.readonly` je „omezený“ rozsah: v testovacím režimu přihlášení vyprší každých 7 dní, produkční režim vyžaduje ověření aplikace Googlem |
| Kde se vybírá | **Výběr Google (Google Picker) v systémovém prohlížeči**, program počká na výsledek / vlastní okno výběru v programu | Picker je oficiální a funguje s `drive.file`; vlastní okno potřebuje `drive.readonly` |
| Čí projekt v Google Cloud | **Vlastní projekt uživatele** (návod v README, ~15 minut) / sdílený projekt autora | Klíče nepatří do veřejného repozitáře; každý si založí svůj |

**Kroky:**

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Ověřovací prototyp (mimo hlavní větev) | Picker na stránce z `http://127.0.0.1:<pevný port>`, přihlášení OAuth s PKCE, vrácení ID vybraných souborů do Go. Ověřit: Picker v prohlížeči na Fedoře, povolený původ `127.0.0.1` s pevným portem, výběr více souborů a složky, nasdílení přes API na souboru z výběru | M |
| 2 | Přihlášení Googlem | OAuth 2.0 pro desktopové aplikace: otevře se systémový prohlížeč, odpověď přijme dočasný server na `127.0.0.1`, PKCE, obnovovací token v `~/.config/playboy-app/google.json` (práva 0600), odhlášení token zruší i u Googlu, v ⋯ → Google Disk; stav přihlášení v nabídce | M |
| 3 | Nastavení projektu | Okno ⋯ → Google Disk → „Nastavit…“: ID klienta a klíč API z vlastního projektu, odkaz na návod; README: oddíl „Google Disk v programu“ krok za krokem (projekt, Drive API a Picker API, obrazovka souhlasu, ID klienta typu Desktop, klíč API omezený na Picker) | S–M |
| 4 | Okno „Vybrat z Disku“ | Tlačítko v okně alba (vedle pole pro odkazy) otevře Picker v prohlížeči; vybrané soubory se vrátí do pole jako odkazy, takže zbytek ukládání zůstává stejný. Více souborů najednou, jen obrázky, vybrat celou složku = všechny obrázky v ní | M |

**Rizika:** Google může změnit pravidla pro Picker nebo rozsahy (prototyp v kroku 1 to ověří dřív, než se
cokoli napojí); `drive.file` nevidí soubory přidané dřív odkazem (pro ně zůstává dnešní kontrola bez
přihlášení); únik tokenu = přístup jen k vybraným souborům, odhlášení token zneplatní.

**Hotovo, když:** na čistém účtu jde podle README založit projekt a přihlásit se; album z 50 fotek ze složky
jde přidat jedním výběrem; odhlášený program dál normálně zobrazuje celou sbírku; token není v databázi,
zálohách ani exportu.

### 1.2 – Google Disk II: výběr všude, nasdílení, záložní adresa

**Cíl:** výběr z Disku na všech místech, kde se přidávají fotky, a konec „nenačtených“ fotek kvůli sdílení.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Napojení na další místa | Cover, titulní fotka modelky, skeny článku, přidání fotek do existujícího alba; vkládání odkazů zůstává jako druhá cesta (funguje bez přihlášení) | S–M |
| 2 | Nasdílení | Po výběru kontrola, které soubory nejsou sdílené „kdokoli s odkazem“; zaškrtávací volba „Nasdílet N souborů“ (nikdy potichu), nasdílení přes API (`permissions.create`, role čtenář, typ kdokoli) | S |
| 3 | Kontrola souborů s přihlášením | Stávající „Zkontrolovat soubory na Disku“ u souborů vybraných přes Picker umí rozlišit „smazané“ od „nenasdílené“ a nabídne nasdílení | S |
| 4 | Záložní adresa obrázků | V ⋯ → Adresa obrázků přednastavená druhá šablona `drive.google.com/thumbnail?id={id}&sz={velikost}` (bez přihlášení, pro sdílené soubory) pro případ, že `lh3` přestane fungovat; přepnutí jedním klikem a ověření na pár fotkách | S |

**Hotovo, když:** cover, titulní fotka i skeny jdou vybrat z Disku; nenasdílené fotky se po zaškrtnutí
nasdílí a zobrazí; přepnutí na záložní adresu obrázků zobrazí sbírku stejně.

### 1.3 – Rychlé drobnosti

**Cíl:** tři malé věci, které zrychlí běžnou práci; každá vyjde jako samostatná verze (1.3.0, 1.3.1, 1.3.2).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Upozornění na duplicitu | Při vkládání odkazů do alba program podle ID souboru najde fotky, které už ve sbírce jsou (u jiné modelky nebo v jiném albu), a ukáže je v okně s volbou „Přidat i tak / Vynechat“; stejné ID dvakrát v jednom vložení se sloučí. Hledání podle indexu na ID souboru | S |
| 2 | Automatické zamčení | Při nastaveném heslu volba v okně hesla: zamknout po 5 / 15 / 30 minutách nečinnosti nebo nikdy (výchozí nikdy); nečinnost = žádná klávesa, klik ani rolování; zamčení schová obsah okna stejně jako při startu | S |
| 3 | Listování ročníky | Na stránce ročníku šipky na předchozí a další rok téže edice (přeskočí roky bez čísel), klávesy `[` a `]` | S |

**Hotovo, když:** vložení odkazu na fotku, která už ve sbírce je, vždy upozorní; okno se samo zamkne po
nastavené době; ročníky jdou listovat šipkami i klávesami.

### 1.4 – Přehledy

**Cíl:** rychlá orientace ve sbírce – co přibylo, kdo fotil, co je výjimečné.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Naposledy přidané | Nová část v Přehledu: dny (dnes, včera, tento týden, starší) a pod nimi modelky, alba a počty fotek přidané ten den, klik otevře profil nebo album; z údajů `pridano`, které už se ukládají | S |
| 2 | Seznam fotografů | Nová část v Přehledu: fotografové podle počtu alb, hledání, klik otevře stránku fotografa | S |
| 3 | Rekordy ve Statistikách | Karta „Rekordy“: nejmladší a nejstarší v době centerfoldu, nejvyšší a nejnižší, nejvíc obálek, nejvíc alb; každý řádek otevře profil | S |

**Hotovo, když:** po dni práce ukáže „Naposledy přidané“ všechno, co přibylo; každý fotograf a rekord
otevře své album nebo profil.

### 1.5 – Náhledy na disku

**Cíl:** karty a dlaždice se zobrazí okamžitě i bez internetu.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Náhledy na disku | Program obsluhuje adresu náhledů sám (vlastní cesta v serveru aplikace, např. `/nahled/{id}/{velikost}`): náhled stáhne jednou, uloží do `~/.cache/playboy-app/nahledy/` a dál ho čte z disku. Jen malé velikosti (karty, dlaždice, plakáty, ~30–60 kB); velké fotky v prohlížeči se dál stahují. Limit velikosti (výchozí 1 GB, nejdéle nepoužité se mažou), úklid náhledů smazaných fotek při spuštění, ⋯ → „Vymazat náhledy“ se zobrazenou velikostí; nenačtený náhled se zkusí znovu po návratu připojení. Mřížky fungují i bez internetu | M |
| 2 | Měření na velké sbírce | Zátěžová zkouška (2 000 modelek, 64 000 fotek) zopakovat po každém kroku; cíl: žádný pohled nad 0,5 s, rolování bez prázdných karet | S |

**Hotovo, když:** po prvním projití sbírky se karty a dlaždice zobrazí okamžitě i bez internetu; mezipaměť
nepřekročí limit; „Vymazat náhledy“ ukáže a uvolní místo.

### 1.6 – Kvalita dat

**Cíl:** Údržba najde víc chyb v datech, přehledy alb mimo profil mají obrázek.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Rozšířené kontroly v Údržbě | Nové druhy úkolů: centerfold bez data narození, cover bez modelky z obálky, stejný fotograf zapsaný různě (podobná jména bez diakritiky a velikosti písmen, např. „Arny Freytag“ / „arny freytag“) s nabídkou sloučení přes stávající přejmenování | M |
| 2 | Titulní fotka alba | Album si pamatuje titulní fotku (první nejlépe hodnocená, jde změnit v nabídce fotky „Nastavit jako titulní fotku alba“); použije se na stránkách fotografa a ročníku **[schéma]** | S–M |

**Hotovo, když:** Údržba najde stejného fotografa zapsaného různě a nabídne sloučení; stránky fotografa
a ročníku ukazují titulní fotky alb; starší databáze i export se převedou (úprava schématu č. 12, export 8).

### 1.7 – Editor I: lišta, náhled, zkratky

**Cíl:** pohodlné psaní článků, rozhovorů, textů alb a poznámek bez psaní formátovacích značek zpaměti.
Text se dál ukládá jako markdown (schéma ani export se nemění), takže starší texty fungují beze změny.

**Rozhodnutí:** vlastní lehký editor nad textovým polem (lišta vkládá značky, vedle živý náhled stávajícím
převodem markdownu) místo editoru „co vidíš, to dostaneš“ z cizí knihovny – žádná nová závislost, žádný
rozdíl mezi náhledem a uloženým textem, funguje se stávajícími zásadami zabezpečení (CSP).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Lišta a náhled | Tlačítka tučné, kurzíva, nadpis, odrážky, číslování, citace, odkaz; obalí vybraný text nebo vloží značku na kurzor; přepínač Psaní / Náhled / Vedle sebe | M |
| 2 | Zkratky a celé okno | Ctrl+B, Ctrl+I, Ctrl+K (odkaz), Tab v odrážkách; tlačítko zvětšení na celé okno pro dlouhé texty, Esc zmenší | S–M |

**Hotovo, když:** text alba jde naformátovat bez ručně psaných značek; texty uložené před 1.7 vypadají
v náhledu stejně jako dřív.

### 1.8 – Editor II: rozhovory a jeden editor všude

**Cíl:** přepis rozhovorů bez psaní značek a stejný editor u všech textů.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Rozhovory | Šablona rozhovoru (perex, mluvčí `PLAYBOY:` / jméno, citace); Enter za odpovědí nabídne dalšího mluvčího; počet slov | S–M |
| 2 | Jeden editor všude | Články, texty alb, poznámky modelek a čísel; stejné chování a zkratky; nápověda a přehled zkratek doplněné | S–M |

**Hotovo, když:** rozhovor o deseti otázkách jde přepsat bez jediné ručně psané značky; články, alba
i poznámky mají stejný editor a zkratky.

### Rezerva – jen když se ukáže potřeba

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Rychlé hodnocení v kartách | Srdíčka na kartách modelek a dlaždicích fotek jdou nastavit kolečkem myši nad srdíčky (ověřit, že nekoliduje s rolováním) – jen pokud se v používání ukáže potřeba | S |
| 2 | „Mám PDF“ u americké edice **[schéma]** | Jen pokud se ukáže potřeba: stav čísla US „mám PDF“ (a cesta nebo odkaz na soubor), filtr a barva v mapě americké edice; úprava schématu č. 12 a export verze 8 | S–M |


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
- Malé náhledy smí program ukládat na disk jako mezipaměť (1.5); originály a velké fotky zůstávají jen na Disku.
- 1.0.0 po 14 dnech používání bety bez nové chyby (21. 10. 2026); po 1.0.0 MINOR pro téma z plánu, PATCH pro
  každý krok a opravu v tématu (1.3.0, 1.3.1…); rozšíření dat MINOR, rozbití starších dat MAJOR.
- Google Disk v aplikaci (1.1–1.2): doporučený rozsah `drive.file` s výběrem Google v prohlížeči a vlastním projektem
  uživatele v Google Cloud – potvrdí se po prototypu (1.1, krok 1).
- Editor textů (1.7–1.8): vlastní lišta nad markdownem s náhledem, žádná knihovna editoru.

## Nedělat

- Obecné Zpět pro všechny úpravy (deník změn) – denní zálohy a Vrátit u fotek stačí.
- Místní kopie fotek v plné velikosti (malé náhledy jako mezipaměť ano, viz 1.5), zálohy na jiný disk.
- Šifrovanou databázi – zvolen zámek rozhraní.
- Půlsrdíčka.
- Zobrazování fotek přes Google API s přihlášením (API jen k výběru fotek, viz 1.1–1.2); automatický import celé
  složky bez výběru, stahování údajů z webu, rozpoznávání obličejů.
- Nové funkce v alfě a betě a změny schématu nebo exportu od alfy.
- Vše z oddílu „Rozhodnuto nedělat“ v `PLAN.md`.
