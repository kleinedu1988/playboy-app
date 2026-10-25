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

## Pravidlo verzování

Platí pro všechny verze od bety dál (zapsáno 23. 10. 2026, hlídá test `TestVerzeSouhlasi`):

- **Tvar `x.xx.xx`** = MAJOR.MINOR.PATCH, tři čísla oddělená tečkou, **bez nul na začátku** (1.1.0, 1.12.3, ne
  1.01.03 – to standard verzování ani `npm` nepřijmou). MINOR a PATCH mají nejvýš dvě číslice (0–99), MAJOR jednu.
- **MAJOR = milník** (řada témat se společným cílem): 0 = vývoj do vydání, 1 = Pohodlí a kvalita dat, 2 = Chytrá
  sbírka. Nový MAJOR začíná `x.0.0`.
- **MINOR = téma** z plánu (jedna verze z tabulky v ROADMAP, 2–4 kroky). Nové téma začíná `x.y.0`; čísla jdou
  za sebou (po 1.9 je 1.10). Kdyby došla čísla (99), začne další milník.
- **PATCH = jeden krok tématu nebo oprava** (1.3.0, 1.3.1, 1.3.2…); opravy pokračují stejnou řadou. Kdyby téma
  potřebovalo víc než 99 vydání, je moc velké a rozdělí se.
- **Každá změna = nová verze:** zápis v `CHANGELOG.md` (s datem), commit a push. Verze se mění na třech místech
  (`verze.go`, `wails.json`, `frontend/package.json`) a v kontrolním součtu `package.json.md5`; test hlídá tvar,
  shodu všech míst a datum v changelogu. Rozpracovaný stav může nést příponu `-dev`.
- **Data:** kompatibilitu nehlídá číslo verze programu, ale verze schématu databáze a formátu exportu (viz „Jak se
  vydává po 1.0.0“).
- **Značky v gitu** (`vX.Y.Z`) se nedělají; historii nese changelog a commity.

### Fáze do 1.0.0

| Fáze | Verze | Co se smí měnit |
|---|---|---|
| Alfa | 0.5x | opravy, doladění rozhraní a zrychlení (MINOR pro větší zásah, PATCH pro opravy); schéma (úprava č. 11) a export (verze 7) zmrazené |
| Beta | 0.90.x | jen opravy chyb; zmrazené i funkce a texty |
| Vydání | 1.0.0 | jen číslo verze a datum v changelogu |

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
modelek po kliknutí (0.92.x) výskyt modelky v časopise nebo jen online (0.93.0) spojení Čísel s Kalendářem (0.94.0) a Statistiky jako jeden graf se seznamem modelek (0.95.0, 0.96.0, 0.98.0) Kontrola s pravidly a „V pořádku“ (0.97.0) a části Přehledu v nabídce tlačítka Přehled (0.99.x) přibyly 22. 10. 2026 na přání uživatele ještě před 1.0; schéma ani formát exportu
se nezměnily. Jedinou výjimkou se změnou schématu jsou **online pictorialy (0.99.9, 24. 10.)**: úprava databáze
č. 12 a export verze 8 (krok 1–2 z 1.23). Lhůta níže proto běží od 0.99.9; nejdřív 7. 11. 2026.

**Pravidlo:** 1.0.0 vyjde po **14 dnech běžného používání bety bez nové chyby**. Lhůta běží od vydání bety
(21. 10. 2026); každá nová chyba zapsaná v `PLAN.md` (oddíl „Chyby z bety“) ji po opravě spustí znovu od
vydání opravy. Změny jen v dokumentaci lhůtu neruší.
Kosmetickou drobnost (vzhled, text), která nebrání práci, smí uživatel vědomě odložit do 1.0.1 – lhůtu pak
neruší. Nejdřív možné vydání: 7. 11. 2026 (po online pictorialech v 0.99.9), pokud se do té doby nic nenajde.

**Ověření před 1.0.0** (odškrtává uživatel na Fedoře; co selže, jde do `PLAN.md` mezi chyby). Scénář bety
z 21. 10. pokryl verzi 0.90.0; od té doby přibyly výjimky z bety a opravy v citlivých místech (import, zálohy,
sloučení), proto se část opakuje:

- [x] `./zkontrolovat.sh` projde bez chyb (0.99.8, 23. 10.)
- [ ] `./zkontrolovat.sh` projde i na 0.99.9
- [ ] `./instalovat.sh` nainstaluje 0.99.9; `--napoveda` vypíše nápovědu, překlep (`--odinstaluj`) ohlásí chybu
- [ ] Přenos dat znovu: ⋯ → Exportovat sbírku, import do čisté sbírky (jiný účet nebo kopie složky dat) a druhý
      import téhož souboru – žádné zdvojené modelky
- [ ] Zálohy: ⋯ → Obnovit ze zálohy…, pak vrácení přes zálohu „Před obnovením“
- [ ] Sloučení dvou modelek (zkušebně, pak vrátit ze zálohy): články a „netýká se“ přejdou na cílovou
- [ ] Kategorie a výskyt: štítky ve formuláři modelky, filtry Kategorie a Výskyt v galerii, hledání `kategorie:`, `vyskyt:online`
- [ ] Čísla: přepínač Obálky / Kalendář, listování obsahem čísla po podržení myši na kartě bez blikání
- [ ] Bez blikání i karty v galerii a fotky v albu při najetí myší
- [ ] Přehled: nabídka tlačítka s grafem (Přehled, Údržba, Sháním CZ, Statistiky)
- [ ] Údržba → Kontrola: nález otevře formulář na správném poli, „V pořádku“ ho schová, „Znovu kontrolovat“ vrátí
- [ ] Statistiky: graf ze seznamu, výběr kliknutím i tažením, výběr platí i v ostatních grafech, Zpět z profilu výběr nezruší
- [ ] Rozepsaný článek nebo úprava čísla: Esc ukáže „Zahodit změny?“ nad oknem
- [ ] Hledání `rok:1977-03` najde jen březen 1977
- [ ] Zamčený program neukazuje pole hledání
- [ ] Online pictorialy: první spuštění 0.99.9 nad sbírkou vytvoří zálohu `*-pred-migraci.db`; v okně alba typ
      „Pictorial online“ skryje vydání a ukáže „Nafoceno“ (chybné datum ohlásí); nadpis alba v profilu s datem;
      album není v kalendáři ani na titulní fotce; výskyt „online“, hledání `nafoceno:2004`, Statistiky → Online;
      export a import alba s datem; proužek „Cyber Girl“ (nebo „Online“) v profilu a kategorie Cyber Girl (0.99.11); volba Cyber Girl of the Week v okně alba spočítá týden z data (0.99.12), of the Month měsíc (0.99.13); typ alba ve dvou řadách Kde vyšlo + Druh (0.99.14)

| Krok | Co |
|---|---|
| 1 | Kontrola: oddíl „Chyby z bety“ v `PLAN.md` je prázdný, 14 dní od poslední opravy uplynulo |
| 2 | Číslo 1.0.0 ve všech souborech verze, oddíl v `CHANGELOG.md` s datem a krátkým shrnutím (bez nových změn) |
| 3 | README: stav „vydáno (1.x)“, ROADMAP: etapa 12 a 13 hotové, další je 1.1 |

## Po 1.0.0

### Jak se vydává po 1.0.0

- **Číslování:** podle oddílu „Pravidlo verzování“ (tvar `x.xx.xx`; MAJOR milník, MINOR téma, PATCH krok
  nebo oprava; první hotový krok tématu vyjde jako 1.3.0, další jako 1.3.1, 1.3.2…). Každá vydaná verze je funkční a projde všemi testy; když je hotový poslední krok tématu, vyzkouší ho uživatel
  na skutečné sbírce. Řady se nemusí střídat přísně za sebou: téma 2.x může vyjít, i když 1.x ještě není celá
  (pak se pokračuje dalším volným číslem v řadě).
- **Data:** kompatibilitu nehlídá číslo verze programu, ale **verze schématu a exportu**. Rozšíření schématu nebo
  exportu (nový sloupec, nový nepovinný údaj) = nová úprava schématu a nová verze exportu; starší program novější
  databázi otevře jen pro čtení a novější export odmítne se srozumitelnou hláškou (obojí už umí). Změna nebo
  odebrání údaje, kvůli kterému by starší export nešel načíst, se dělá jen výjimečně a s převodem.
- **Údržba (průběžně, jako PATCH):** Wails 2.17.0 (s ověřením na Fedoře: okno, nabídky, poblikávání),
  aktualizace Go a knihoven, `govulncheck` u uživatele.
- U každé verze: kroky v pořadí, ve kterém se dělají; **[schéma]** = mění databázi nebo export.

Každá verze níže je malá a ucelená (zhruba 1–3 dny práce, 2–4 kroky) a dá se vyzkoušet sama o sobě.
Pořadí jde změnit, závislosti jsou uvedené. **Revize 23. 10. 2026:** témata přečíslovaná podle priority a rozdělená
do dvou řad; sloupec „Dřív“ uvádí původní číslo (to používají návrhy v `docs/`).

| Verze | Obsah | Závisí na | Dřív |
|---|---|---|---|
| **1.x** | **Pohodlí a kvalita dat** | | |
| 1.1 | Rychlé přidávání I – centerfold a pictorial v jednom okně, „na obálce“ u coveru, titulní fotka sama, další číslo jako výchozí | – | nové |
| 1.2 | Přidat číslo – průvodce pro celé číslo, klávesnice, Vrátit přidání, fronta ze seznamu, schránka a přetažení odkazů | 1.1 | nové |
| 1.3 | Google Disk I – přihlášení a výběr fotek do alba | – | 1.1 |
| 1.4 | Google Disk II – výběr všude, nasdílení, oprava odkazů („Vyměnit soubor“) | 1.3 | 1.2 |
| 1.5 | Údaje rychleji – vložení datového listu, „jako předchozí“, hodnocení postupně | 1.2 | nové |
| 1.6 | Náhledy na disku – mezipaměť náhledů, limit, bez připojení, záložní adresa | – | 1.5 |
| 1.7 | Rychlé drobnosti – duplicita, náhled vložených odkazů, zamčení po nečinnosti, listování ročníky a čísly | – | 1.3 |
| 1.8 | Zálohy a aktualizace – záloha během dne, aktualizace jedním příkazem, upozornění na novou verzi | – | nové |
| 1.9 | Kvalita dat – sjednocení zápisů, titulní fotka alba, nové úkoly v Údržbě, kontrola při zadávání **[schéma]** | – | 1.6 |
| 1.10 | Kontrola 2.0 – postava podle období, jistota a řazení, návrh opravy, pamatování nálezů | 1.9 | 1.16 |
| 1.11 | Přehledy – Přibylo s denním souhrnem, fotografové, rekordy | 1.9 | 1.4 |
| 1.12 | Úplnost a ročníky – úplnost po desetiletích, filtr Údržby podle let, rozpracovaný ročník | 1.11 | nové |
| 1.13 | Hromadné úpravy a sloučení s porovnáním údajů | – | nové |
| 1.14 | Editor I – ochrana textu, lišta, náhled, zkratky | – | 1.7 |
| 1.15 | Editor II – rozhovory, jeden editor všude, sken vedle textu, pravopis | 1.14 | 1.8 |
| 1.16 | Texty III – jména modelek v textu, najít a nahradit, zvýraznění, typografie | 1.15 | nové |
| 1.17 | Obsah čísla a tisk článku | 1.14 | nové |
| 1.18 | Kontrola 2.1 – učení z rozhodnutí, jména podle období | 1.10 | 1.16 |
| 1.19 | Přístupnost – přiblížení, popisky pro čtečku | – | nové |
| 1.20 | Wikidata I – návrh údajů u modelky | – | 1.12 |
| 1.21 | Wikidata II – hromadně v Údržbě, příprava dalšího roku | 1.20 | 1.13 |
| 1.22 | Kvalita kódu a testy – výpočty Statistik a Přehledu do `src/lib` s testy, chybějící testy backendu, jeden správce oken a rozepsaných změn, test rozhraní v Playwrightu | – | nové (revize) |
| 1.23 | Online pictorialy – typ alba „Pictorial online“ s datem nafocení (jen informace, nemění vydání ani titulní fotku), výskyt „online“ podle něj; zařadit hned za 1.9 | 1.9 (úprava schématu č. 12) | nové |
| **2.x** | **Chytrá sbírka** | | |
| 2.0 | Chytré hledání I – synonyma, našeptávač, učení z otevíraných výsledků | – | 1.9 (kroky 1, 2, 6, 7) |
| 2.1 | Chytré hledání II – česká věta jako filtr a Síť slov (malá znaková neuronová síť) | 2.0 | 1.9 (kroky 3, 4) + síť |
| 2.2 | Podobné modelky, „jako X“, Tento den v historii | – | 1.9 (krok 5), 1.10 |
| 2.3 | Mohlo by se ti líbit – návrh srdíček u nové modelky, soudržnost hodnocení, fotky, které by se mohly líbit | 2.2 | 1.17 |
| 2.4 | Postřehy ve Statistikách – trendy, zlomy, výběr proti sbírce, neobvyklé roky | – | 1.18 |
| 2.5 | Mapa sbírky – malá neuronová síť (autoenkodér): mapa modelek, podobnost, druhý názor Kontroly | 2.2 | 1.19 |
| 2.6 | Stejné a podobné fotky (otisk obrázku) | 1.6 | 1.11 |
| 2.7 | Chytré výběry **[schéma]** | 2.0 | 1.14 |
| 2.8 | Kvíz „Poznej playmate“ | 2.2 | 1.15 |
| rezerva | Hodnocení kolečkem myši, „mám PDF“ u americké edice **[schéma]** – jen když se ukáže potřeba | – | |

### Doplňky z revize kódu (23. 10. 2026)

Pět agentů prošlo kód (zprávy `docs/REVIZE-GO-DATA.md`, `REVIZE-GO-LOGIKA.md`, `REVIZE-FRONTEND-LOGIKA.md`,
`REVIZE-ROZHRANI.md`, `REVIZE-TESTY-SESTAVENI.md`). Chyby jsou opravené v 0.99.6–0.99.8; zbytek patří sem:

| Kam | Co |
|---|---|
| 1.0.x (údržba, PATCH) | ověření šablony adresy obrázků bez souběhu (`SetSablonaObrazku`); drobnosti hledání (prázdné pole v dotazu, význam `hodnoceni:<N`, regulární výraz jednou); úplnější CSP s ověřením na Fedoře; odpojení `ResizeObserver` a jedno `GetStatistiky`; historie bez zdvojení, srdíčka bez souběhu dvou kliků, `localStorage` v `try`; delší čekání u importu, `Sync` při kopírování, `SetNetykaSe` v transakci; úklid zdvojeného a mrtvého CSS (55 selektorů); ověřit na Fedoře, zda neblikají karty galerie a fotky alba (stejný vzor jako kalendář před 0.94.4); Wails 2.17.0, aktualizace závislostí, `govulncheck` |
| 1.6 Náhledy na disku | dřívější opakované ověření nedostupných fotek v denní dávce |
| 1.8 Zálohy a aktualizace | `npm ci` místo `npm install`; zámek při výměně databáze během obnovení; export z jedné čtecí transakce (dnes 5,7 s při 5 000 modelkách a 100 000 fotkách, cíl < 1 s); úklid mezipaměti při odinstalaci; ikony 256/512 připravené předem |
| 1.9 Kvalita dat | řady edic US/CZ i v backendu a kontrola „číslo mimo řadu edice“; volitelný úklid prázdných alb vzniklých před 0.99.8 |
| 1.10 Kontrola 2.0 | věk při prvním vydání i u data narození jen rokem |
| 1.19 Přístupnost | role dialogu u oken, oznámení pro čtečku (`aria-live`), názvy ikonových tlačítek (+, ⋯), kontrast placeholderů, `prefers-reduced-motion` všude, hledání i v úzkém okně (pod 421 px), zásobník vrstev pro Esc, Tab a fokus |
| 1.22 Kvalita kódu a testy | viz tabulka verzí |
| 2.0 Chytré hledání I | levnější záložní hledání článků v našeptávači |

## Řada 1.x – Pohodlí a kvalita dat

Pořadí podle denního používání (desítky modelek denně, chronologicky): nejdřív rychlejší přidávání, pak výběr
z Disku a náhledy, zálohy, kvalita dat a Kontrola 2.0, přehledy, editor; Wikidata nakonec a jen po rozhodnutí.
Rozpracování kroků a rozšíření (revize 23. 10. 2026): [PLAN-1X-ROZSIRENI.md](docs/PLAN-1X-ROZSIRENI.md),
[PLAN-1X-DISK.md](docs/PLAN-1X-DISK.md), [PLAN-1X-DATA.md](docs/PLAN-1X-DATA.md), [PLAN-1X-TEXTY.md](docs/PLAN-1X-TEXTY.md)
(návrhy používají vlastní předběžná čísla; platí tabulka verzí).

### 1.1 – Rychlé přidávání I

**Cíl:** přidání čísla (centerfold, cover, pictorial) s méně okny a bez opakovaného psaní jména, fotografa
a vydání. Uživatel přidává desítky modelek denně chronologicky, proto jde před Google Disk (1.3). **Bez změny
schématu i exportu.** Rozbor: [PLAN-1X-ROZSIRENI.md](docs/PLAN-1X-ROZSIRENI.md).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Centerfold a pictorial v jednom okně | U centerfoldu tlačítko „Uložit a přidat pictorial“: okno zůstane, typ se přepne na Pictorial, modelka, fotograf a vydání zůstanou, název `Pictorial RRRR-MM` předvyplněný | S |
| 2 | Na obálce u coveru | Pole „Na obálce“ v okně coveru, předvyplněné centerfoldem čísla (jen prázdné), uložení přes `SetVydaniInfo`; „Uložit a další cover“ | S |
| 3 | Titulní fotka sama | Modelka bez titulní fotky dostane po uložení centerfoldu jeho první stránku (bez centerfoldu první fotku pictorialu); ruční volba se nepřepíše, import beze změny | S |
| 4 | Další číslo jako výchozí | Okna z tlačítka + bez daného čísla nabídnou první číslo po posledním centerfoldu edice (`dalsiCislo`, přeskočí nevydaná); „Pokračovat: MM/RRRR →“ na úvodu Přehledu a v kalendáři | S |

**Hotovo, když:** centerfold a pictorial jedné modelky jdou uložit v jednom okně bez druhého psaní jména;
cover uloží i modelku z obálky; nová modelka s centerfoldem má titulní fotku; okno z tlačítka + nabídne
další chybějící číslo.

### 1.2 – Přidat číslo

**Cíl:** celé číslo v jednom okně a jen klávesnicí; přidání jedné playmate z ~24 akcí na ~8. **Bez změny
schématu i exportu.** Závisí na 1.1 (další číslo).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Průvodce „Přidat číslo“ | Okno `pridat-cislo.js`: vydání, centerfold (jméno, fotograf, odkazy), cover (odkazy, na obálce), pictorialy, srdíčka; `PridatCislo` v `pridani.go` – ověření souborů předem, uložení v jedné transakci, kontrola duplicity jména a druhého centerfoldu; „Uložit a další číslo“ | M–L |
| 2 | Klávesnice | `Ctrl+N` Nová modelka, `Ctrl+Shift+N` Přidat číslo, `Ctrl+Enter` uloží okno, „Přidat a další“ v okně Nová modelka, 1–5 a 0 hodnotí modelku v profilu; přehled zkratek | S |
| 3 | Vrátit přidání | Oznámení „Přidáno 07/1977: …“ s Vrátit: smaže přesně vytvořené (modelku jen novou a bez dalších alb), záloha před vrácením; cílené Vrátit, ne deník změn | S–M |
| 4 | Fronta ze seznamu | „Vložit seznam…“ v průvodci (`1977-07 Jméno`, `July – Jméno`, tabulka z Wikipedie), náhled, fronta v `nastaveni`; průvodce jde číslo po čísle s předvyplněným měsícem a jménem | S–M |

**Hotovo, když:** číslo s centerfoldem, coverem a pictorialem jde přidat jedním oknem bez myši; chyba
uprostřed neuloží nic; Vrátit vrátí sbírku do stavu před uložením; seznam dvanácti playmate roku projde
frontou bez psaní jmen.

**Doplněk z [PLAN-1X-DISK.md](docs/PLAN-1X-DISK.md) („Rychlé přidávání“):** klávesy v okně alba (Ctrl+Enter, Alt+D
po 1.3), nabídka vložit odkazy ze schránky a přetažení odkazů z prohlížeče – zapracovat do kroků této verze.

### 1.3 – Google Disk I: přihlášení a výběr do alba

**Cíl:** fotky do alba přidávat výběrem z Disku přímo v programu místo kopírování odkazů (výběr na dalších
místech a nasdílení přijdou v 1.4). Prohlížení sbírky se nemění: fotky se dál zobrazují přes sdílené odkazy bez
přihlášení, takže odhlášení nebo vypršené přihlášení nikdy nezablokuje prohlížení. **Bez změny schématu
i exportu** – do databáze se dál ukládá jen ID souboru. Přihlašovací token se ukládá mimo databázi do
`~/.config/playboy-app/google.json` (práva jen pro uživatele), takže se nedostane do záloh, exportu ani
při přenosu složky dat na jiný počítač (tam se přihlásí znovu). Kroky podrobně: [PLAN-1X-DISK.md](docs/PLAN-1X-DISK.md).

**Rozhodnutí před začátkem:** rozsah `drive.file`, výběr Google (Picker) v systémovém prohlížeči, vlastní projekt
uživatele v Google Cloud (viz Rozhodnuto); potvrdí je prototyp.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 0 | Ověřovací prototyp (nevydává se) | Picker z `http://127.0.0.1:<pevný port>`, OAuth s PKCE, `setAppId` s číslem projektu, výběr 50+ souborů, výběr složky (dá `drive.file` přístup k souborům v ní?), `permissions.create`, produkční režim bez ověření a token po 7 dnech; výsledky do `PLAN.md` | M |
| 1 | Nastavení projektu a přihlášení (1.3.0) | `google.go`: OAuth pro desktop s PKCE a dočasným serverem na `127.0.0.1`, obnovovací token v `google.json` (0600), odhlášení zruší token i u Googlu; okno ⋯ → Google Disk… (ID klienta, klíč API, číslo projektu, stav); README „Google Disk v programu“ krok za krokem | M–L |
| 2 | Vybrat z Disku v okně alba (1.3.1) | Tlačítko u pole odkazů otevře Picker v prohlížeči, program počká (Zrušit); vybrané obrázky se vrátí do pole jako odkazy seřazené přirozeně podle názvu souboru, ukládání beze změny | M |
| 3 | Celá složka a velké výběry (1.3.2) | Podle prototypu výběr složky nebo Ctrl+A v Pickeru; vložený odkaz na složku nabídne „Vybrat tuto složku z Disku…“; nad 300 souborů potvrzení; `AddBulkPhotos` v jedné transakci a s kontrolou duplicit jedním dotazem | S–M |

**Rizika:** Google může změnit pravidla pro Picker nebo rozsahy (prototyp to ověří dřív, než se cokoli napojí);
`drive.file` nevidí soubory přidané dřív odkazem (pro ně zůstává dnešní kontrola bez přihlášení); únik tokenu =
přístup jen k vybraným souborům, odhlášení token zneplatní.

**Hotovo, když:** na čistém účtu jde podle README založit projekt a přihlásit se; album z 50 fotek ze složky
jde přidat jedním výběrem ve správném pořadí; odhlášený program dál normálně zobrazuje celou sbírku; token
není v databázi, zálohách ani exportu.

### 1.4 – Google Disk II: výběr všude, nasdílení, oprava odkazů

**Cíl:** výběr z Disku na všech místech, kde se přidávají fotky, a konec „nenačtených“ fotek kvůli sdílení
nebo smazání. Záložní adresa obrázků se přesunula do 1.6 (server náhledů ji použije sám).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Napojení na další místa (1.4.0) | „Z Disku…“ u titulní fotky, coveru, skenů článku a v nabídce alba „Přidat fotky z Disku…“; vkládání odkazů zůstává jako druhá cesta (funguje bez přihlášení) | S–M |
| 2 | Nasdílení (1.4.1) | Po výběru kontrola, které soubory nejsou sdílené „kdokoli s odkazem“; zaškrtávací volba „Nasdílet N souborů“ (nikdy potichu), `permissions.create` (čtenář, kdokoli), 4 souběžně, pauza při 429 | S |
| 3 | Kontrola s přihlášením a Vyměnit soubor (1.4.2) | U souborů z výběru „Zkontrolovat soubory“ rozliší v koši / smazaný / nenasdílený a nabídne nasdílení; „Vyměnit soubor z Disku…“ u nenačtené fotky a v Údržbě přepíše jen ID souboru, hodnocení, pořadí a otočení zůstanou, jde vrátit | M |

**Hotovo, když:** cover, titulní fotka i skeny jdou vybrat z Disku; nenasdílené fotky se po zaškrtnutí
nasdílí a zobrazí; smazaný a nenasdílený soubor se v kontrole rozliší; nefunkční fotka jde vyměnit bez ztráty
hodnocení.

### 1.5 – Údaje rychleji

**Cíl:** údaje a srdíčka nové modelky bez přepisování pole po poli. Uživatel text vkládá sám, program nic
nestahuje. **Bez změny schématu i exportu.**

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Vložení datového listu | `rozlozitUdaje` v `lib/format.js` (narození, místo, výška, váha, míry, vlasy, oči; anglicky i česky); ve formuláři a v průvodci pole „Vložit údaje…“: štítky rozpoznaných hodnot, prázdná pole se vyplní, odlišná jen ⚠; testy na 20 skutečných ukázkách | M |
| 2 | Jako předchozí | Tlačítko a `Alt+P`: ochlupení, tetování, piercing, typ prsou a národnost z naposledy uložené modelky, jen do prázdných polí a zvýrazněné | S |
| 3 | Hodnocení postupně | Překryv nad filtrem Hodnocení v Údržbě (i z výběru karet): velká fotka, 1–5 uloží a ukáže další, ← předchozí, Esc | S–M |

**Hotovo, když:** datový list vložený do formuláře vyplní všechna rozpoznaná pole a nic nepřepíše bez
potvrzení; dvacet modelek bez srdíček jde ohodnotit dvaceti klávesami.

### 1.6 – Náhledy na disku

**Cíl:** karty a dlaždice se zobrazí okamžitě i bez internetu. Jen malé náhledy (`w400`, `w600`); velké fotky
se dál stahují z Disku. Bez změny schématu i exportu.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Server náhledů (1.6.0) | `nahledy.go` jako `Handler` serveru aplikace: šablona obrázků `/nahled/{id}/{velikost}`, malé velikosti stáhne jednou do `~/.cache/playboy-app/nahledy/` (zápis přes dočasný soubor), velké propustí bez uložení; 8 souběžně, stejný požadavek = jedno stažení, zrušený požadavek zruší stažení; kontrola souborů dál jde přímo na Disk | M |
| 2 | Limit a správa (1.6.1) | Velikost spočítaná na pozadí, nad limitem se mažou nejdéle nepoužité (čas použití v `mtime`), úklid náhledů smazaných fotek po startu; okno ⋯ → Náhledy… s velikostí, limitem (500 MB–5 GB, `nastaveni`), odhadem celé sbírky, Vymazat náhledy a mezipaměť prohlížeče | S–M |
| 3 | Záložní adresa a bez připojení (1.6.2) | Při chybě `lh3` server zkusí `drive.google.com/thumbnail?id={id}&sz={velikost}`; předvolba v ⋯ → Adresa obrázků; bez připojení chybějící náhled hned 503 (rozhraní ho načte po návratu připojení); CSP `img-src` (ověřit na Fedoře) | S |
| 4 | Náhledy předem a měření (1.6.3) | „Stáhnout chybějící náhledy“ na pozadí (titulní fotky, plakáty, ohodnocené fotky, ostatní), 4 souběžně, pauza při výpadku a 429, pokračuje po restartu, zastaví se u limitu; zátěžová zkouška 2 000 modelek / 64 000 fotek: pohled pod 0,5 s, rolování bez prázdných karet, start pomalejší nejvýš o 50 ms | M |

**Hotovo, když:** po stažení náhledů se karty a dlaždice celé sbírky zobrazí okamžitě i bez internetu;
mezipaměť nepřekročí limit; „Vymazat náhledy“ ukáže a uvolní místo; přepnutí na záložní adresu zobrazí
sbírku stejně.

### 1.7 – Rychlé drobnosti

**Cíl:** čtyři malé věci, které zrychlí běžnou práci; každá vyjde jako samostatná verze (1.7.0–1.7.3).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Upozornění na duplicitu (1.7.0) | Při ukládání okna alba program podle ID souboru najde fotky, které už ve sbírce jsou (u jiné modelky, v jiném albu, jako titulní fotka), a ukáže je v okně s volbou „Vynechat je / Přidat i tak“; jeden dotaz `IN (…)` bez nového indexu (index případně v 1.9) | S |
| 2 | Náhled vložených fotek (1.7.1) | Pod polem odkazů pás malých náhledů se stavem každé fotky (v pořádku, už ve sbírce, nenačte se) a ✕ pro odebrání odkazu; obnoví se po vložení | S–M |
| 3 | Automatické zamčení (1.7.2) | Při nastaveném heslu volba v okně hesla: zamknout po 5 / 15 / 30 minutách nečinnosti nebo nikdy (výchozí nikdy); nečinnost = žádná klávesa, klik ani rolování; zamčení překryvem bez přenačtení okna, takže rozepsaný formulář zůstane | S |
| 4 | Listování ročníky a čísly (1.7.3) | Na stránce ročníku šipky na předchozí a další rok téže edice, na stránce čísla na předchozí a další číslo (přeskočí čísla, která nevyšla); klávesy `[` a `]` | S |

**Hotovo, když:** vložení odkazu na fotku, která už ve sbírce je, vždy upozorní; vložené odkazy jsou před
uložením vidět jako náhledy; okno se samo zamkne po nastavené době a rozepsaný text nezmizí; ročníky i čísla
jdou listovat šipkami i klávesami.

### 1.8 – Zálohy a aktualizace

**Cíl:** práce dne je zálohovaná týž den a aktualizace je jeden příkaz. **Bez změny schématu i exportu.**
Zálohy zůstávají ve složce záloh (Nedělat: zálohy na jiný disk).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Záloha během dne | Záloha „Při zavření“, když se od poslední zálohy databáze změnila (fronta 7); denní záloha i za běhu, když se změní den; chyba zavření neblokuje | S |
| 2 | Aktualizace jedním příkazem | `./instalovat.sh --aktualizovat`: čistý `git status`, `git pull --ff-only`, sestavení, instalace, výpis verzí a nadpisů změn; README | S |
| 3 | Upozornění na novou verzi | Cesta ke klonu předaná při sestavení; jednou denně `git fetch` na pozadí (bez dotazu na heslo, limit 10 s), novější `Verze` → oznámení s „Co je nového“; vypnutí v ⋯, bez sítě mlčí | S–M |
| 4 | Import ze schránky | ⋯ → „Importovat ze schránky…“: YAML nebo Markdown vložený do okna, `ImportovatText` nad stávajícím importem, záloha před importem | S |

**Hotovo, když:** po zavření programu je v seznamu záloha s dnešní prací; `./instalovat.sh --aktualizovat`
na čistém klonu aktualizuje a s místní změnou nic nepřepíše; novější verze v repozitáři se ohlásí nejvýš
jednou denně.

### 1.9 – Kvalita dat **[schéma]**

**Cíl:** chyby a nejednotné zápisy se najdou v Údržbě i přímo při zadávání; alba mají vlastní titulní fotku.
Úprava schématu č. 13 a export verze 9 (krok 2; č. 12 a export 8 použily online pictorialy v 0.99.9); ostatní kroky schéma nemění. Každý krok vyjde jako
samostatná verze (1.9.0–1.9.3). Rozpracování: [PLAN-1X-DATA.md](docs/PLAN-1X-DATA.md).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Sjednocení zápisů | `GetRuzneZapisy`: fotograf (dělený čárkou), národnost, místo narození, vlasy, oči, etnicita, tagy – stejné bez diakritiky, Jaro–Winkler ≥ 0,92, iniciála, prohozené pořadí; filtr „Zápisy“ v Údržbě, „Sjednotit na …“ se zálohou, „Různí lidé“ v `nastaveni`; oprava `PrejmenovatFotografa` a `GetAlbaFotografa` pro víc fotografů v poli | M |
| 2 | Titulní fotka alba a nové klíče **[schéma]** | Úprava č. 13: `alba.titulni` (ID souboru), `vydani.netyka_se`, `modelky.upraveno` (datum poslední úpravy – „Naposledy upravené“ v galerii a řazení, bez historie změn); klíče `fotograf` (album) a `obalka` (číslo); nabídka fotky „Nastavit jako titulní fotku alba“, použití na stránce fotografa a ročníku; export 9 (`titulni_fotka`, `netyka_se` u čísla), `EXPORT.md`, test verze dat a přechodu ze starých verzí | S–M |
| 3 | Nové úkoly v Údržbě | Playmate bez data narození (vlastní filtr, vyšší váha), číslo s coverem bez modelky z obálky, centerfold a pictorial bez fotografa; „Netýká se“ s novými klíči; řádky v souhrnu úvodu | M |
| 4 | Kontrola při zadávání | `PodobneModelky` při psaní jména (práh 0,88, nejvýš 3 s fotkou), „Myslel jsi …?“ u fotografa a národnosti, `ZkontrolovatModelku` po uložení s oznámením a Opravit; „Sloučit…“ u nálezu podobného jména | M |

**Hotovo, když:** varianty fotografa jdou sjednotit jedním klikem a album se dvěma fotografy je na obou
stránkách; titulní fotka alba se ukazuje na stránce fotografa a ročníku; nové úkoly jdou doplnit i označit
„Netýká se“; překlep ve jméně existující modelky se ukáže při psaní a výška 17 cm hned po uložení; přechod
na úpravu č. 13 projde ze všech starých verzí, export 9 → import vrátí totéž, 1.7 otevře novou databázi jen pro
čtení a export 9 odmítne srozumitelnou hláškou.

### 1.23 – Online pictorialy (kroky 1–2 hotové v 0.99.9, krok 3 hned za 1.9)

**Cíl:** tři druhy výskytu modelky odpovídají albům: **Centerfold** (playmate – odvodí kategorii Playmate měsíce),
**Pictorial** (u čísla časopisu) a nově **Pictorial online** (Cyber Girl, Coed, Muse… – pictorialy jen na webu).
Online album má **datum nafocení nebo zveřejnění** (RRRR, RRRR-MM nebo RRRR-MM-DD): je to jen informace u alba,
nepřenáší se do vydání, kalendáře ani na titulní fotku modelky. **Hotovo v 0.99.9** (výjimka v betě): úprava
schématu č. 12 (`alba.datum`), export verze 8, typ v okně alba, nadpis s datem, výskyt „online“, `nafoceno:`,
Statistiky „Online“. Zbývá filtr typu alba a `typ:online` (k 1.9) a krok 3.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 ✓ | Typ a datum v okně alba | Typ „Pictorial online“ vedle Pictorial, Centerfold, Cover; u něj pole „Nafoceno“ místo vydání (kontrola tvaru jako u data narození); v profilu nadpis alba s datem („Pictorial online · nafoceno 06/2004“) | S–M |
| 2 (část ✓) | Výskyt a filtry | Modelka s online albem a bez čísla má výskyt „jen online“ i bez online kategorie; filtr typu alba a hledání `typ:online`, `nafoceno:2004`; Statistiky: druh výskytu „Pictorial online“ (rok = datum nafocení) | M |
| 3 | Převod starších alb | Údržba nabídne alba Pictorial bez vydání u modelek s online kategorií k převedení na „Pictorial online“ (po jednom nebo hromadně, s potvrzením) | S |

**Hotovo, když:** Cyber Girl s online albem z 06/2004 má výskyt „jen online“, album ukazuje datum nafocení,
kalendář ani titulní fotka se nezměnily; export 8 datum i typ přenese a starší program novější export odmítne.

### 1.10 – Kontrola 2.0

**Cíl:** kontrola v Údržbě porovnává modelky se stejnou dobou, řadí nálezy podle jistoty chyby, navrhne opravu
překlepu a začne si pamatovat opravy i „V pořádku“. **Bez změny schématu i exportu** – snímek nálezů a počty
jsou v tabulce `nastaveni`. Každý krok vyjde jako samostatná verze (1.10.0–1.10.3); učení z rozhodnutí je
v 1.18. Rozbor možností: [NAVRH-KONTROLA2.md](docs/NAVRH-KONTROLA2.md), kroky: [PLAN-1X-DATA.md](docs/PLAN-1X-DATA.md).

**Rozhodnutí:** klouzavé okno ±5 let podle prvního vydání přitažené k celé sbírce, na okraji sbírky (nejnovější
roky) silněji (ne desetiletí ani regrese); jistota = šance pravidla × vzácnost hodnoty (ne naučený klasifikátor);
návrh opravy jen při jediném kandidátovi v rozsahu období; opravy se poznají ze snímku ukázaných nálezů
v `nastaveni` (ne deník změn).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Postava podle období | Měření na kopii sbírky (`PLAYBOY_DB`); medián a σ po rocích (okno ±5 až ±15 let, ≥ 40 hodnot), přitažení w = n/(n+40), na okraji sbírky n/(n+80); z-skóre kombinací vůči období s korelací z celé sbírky; text „kolem roku 1962 obvykle …“ | M–L |
| 2 | Jistota a řazení | `Jistota` z vzácnosti hodnoty (t-rozdělení, χ², podobnost jmen) a přesnosti pravidla, i u pravidel z 1.9; „skoro jistě překlep“ / „možná chyba“; Kontrola řazená podle jistoty; slabé nálezy za odkazem; „Proč je to podezřelé?“ v ⋯ | M |
| 3 | Návrh opravy | Vzory: chybějící, přidaná a prohozená číslice, desetinná čárka, palce, libry, obvody v palcích, prohozený pas a boky, den a měsíc; kandidát v rozsahu období; „Použít 170“ s Vrátit, i v oznámení po uložení | M |
| 4 | Pamatování nálezů | Otisk údajů nálezu, snímek v `nastaveni`, porovnání v `GetPrehled`: zmizelý nález se změněným údajem = opraveno, „V pořádku“ = planý poplach; import, obnovení a hromadné změny se nepočítají; nálezy z oznámení po uložení se zapíší taky; okno ⋯ → Kontrola údajů… s počty | M |

**Nedělá se:** nové klíče `ok-…`, deník změn, knihovny strojového učení, skrývání tvrdých pravidel.

**Hotovo, když:** v testu se pas 70 cm v roce 1962 hlásí a v roce 2008 ne a sbírka uříznutá v roce 1977 nemá
na okraji víc nálezů; z prvních 20 nálezů skutečné sbírky je aspoň 15 skutečná chyba; „výška 17 cm“ nabídne
170 cm a u 20 vzorových překlepů je návrh správný aspoň v 18; oprava se započítá jako „opraveno“ a import ne;
kontrola 5 000 modelek do 120 ms; schéma ani export se nemění.

### 1.11 – Přehledy

**Cíl:** rychlá orientace ve sbírce – co přibylo, kdo fotil, co je výjimečné. Bez změny schématu i exportu.
Každý krok vyjde jako samostatná verze (1.11.0–1.11.2).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Přibylo | Nová část Přehledu: dny (dnes, včera, tento týden, starší), modelky, alba s titulní fotkou a počty fotek z `pridano`; nahoře denní souhrn „Dnes 23 modelek · chybí 2× srdíčka, 5× narození, 1× ke kontrole“ s odkazem do Údržby jen na dnešní modelky; karta na úvodu zůstává jako náhled | S–M |
| 2 | Fotografové | Nová část Přehledu: fotografové (jména dělená čárkou a sjednocená) s počtem alb a modelek, obdobím a titulní fotkou posledního alba; hledání, řazení, klik otevře stránku fotografa; ⋯ Přejmenovat, Sjednotit s… | S–M |
| 3 | Rekordy ve Statistikách | Karta „Rekordy“: věk v době centerfoldu, výška, váha, pas, nejvíc centerfoldů, obálek, alb a fotek, nejdelší působení; podle výběru Statistik; hodnota, která čeká na kontrolu, se nepočítá („3 hodnoty čekají na kontrolu →“); každý řádek otevře profil | S–M |

**Hotovo, když:** po dni práce ukáže „Přibylo“ všechno, co přibylo, a souhrn odpovídá Údržbě; každý fotograf
ze Statistik je v seznamu se stejným počtem alb; každý rekord otevře profil a podezřelá hodnota mezi rekordy není.

### 1.12 – Úplnost a ročníky

**Cíl:** práce po letech – vidět, kde data zaostávají, a dodělat rozpracovaný ročník. Bez změny schématu
i exportu. Navrženo hned po 1.11.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Úplnost po desetiletích | Tabulka desetiletí × skupiny údajů (% vyplněno bez „netýká se“), cíl v ⋯ (výchozí 90 %, v `nastaveni`), buňka pod cílem otevře Údržbu s filtrem | S–M |
| 2 | Filtr Údržby podle let | Rok nebo rozsah podle prvního vydání modelky a vydání čísla | S |
| 3 | Rozpracovaný ročník | Karta na úvodu: poslední rok s přírůstkem za 7 dní – centerfoldy, covery, úplné údaje, srdíčka, ke kontrole; klik otevře ročník nebo Údržbu toho roku | S–M |

**Hotovo, když:** úplnost desetiletí odpovídá Údržbě s filtrem těch let; karta ukáže rozpracovaný ročník
a každé její číslo vede na úkoly toho roku.

### 1.13 – Hromadné úpravy a sloučení

**Cíl:** jeden údaj u mnoha modelek najednou a sloučení duplicit s rozhodnutím po polích. Bez změny schématu
i exportu. Navrženo po 1.12.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Výběr modelek | Ctrl/Shift + klik a Ctrl+A v galerii jako u fotek, „Vybrat výsledky hledání“ | M |
| 2 | Upravit údaj… | Pole, „jen prázdné“ / „přepsat“, náhled počtu změn, záloha předem, Vrátit v oznámení (ne deník) | M |
| 3 | Sloučení s porovnáním | Dva sloupce údajů, volba u rozdílných, z profilu i z nálezu Kontroly | M |

**Hotovo, když:** 20 modelek dostane národnost jedním krokem a Vrátit je vrátí; sloučení zachová zvolené hodnoty.

### 1.14 – Editor I: ochrana textu, lišta, náhled, zkratky

**Cíl:** přepis článku bez psaní formátovacích značek zpaměti a bez rizika ztráty textu. Text se dál ukládá
jako markdown (schéma ani export se nemění), takže starší texty fungují beze změny. Zatím okno článku,
ostatní texty v 1.15. Rozbor kroků: [PLAN-1X-TEXTY.md](docs/PLAN-1X-TEXTY.md).

**Rozhodnutí:** vlastní lehký editor nad textovým polem (lišta vkládá značky, vedle živý náhled stávajícím
převodem markdownu) místo editoru „co vidíš, to dostaneš“ z cizí knihovny – žádná nová závislost, žádný
rozdíl mezi náhledem a uloženým textem, funguje se stávajícími zásadami zabezpečení (CSP). Značky se vkládají
přes `insertText`, aby fungovalo Ctrl+Z.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Ochrana rozepsaného textu | Okno článku a okno čísla v `oknaSFormularem` (Esc a Zrušit se zeptají); koncept textu článku každých 5 s v `localStorage`, při dalším otevření nabídka „Obnovit koncept“ | S |
| 2 | Lišta a odkazy | `lib/editor.js` (obalení výběru, předpona řádků, přečíslování, s testy) a `ui/editor.js`; tlačítka tučné, kurzíva, nadpis, odrážky, číslování, citace, odkaz; převod markdownu pozná `[text](https://…)` jako odkaz do prohlížeče | M |
| 3 | Náhled | Psaní / Náhled / Vedle sebe (od 900 px), `formatMarkdown` se stejnými volbami jako v čísle, překreslení po 150 ms, náhled sleduje kurzor | M |
| 4 | Zkratky, celé okno, počet slov | Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+1–3; Enter v odrážce pokračuje, na prázdné ukončí; Tab jen v odrážkách; ⤢ / Ctrl+Shift+F celé okno, Esc nejdřív zmenší; stavový řádek slova, znaky, čtení | S–M |

**Hotovo, když:** článek jde naformátovat bez ručně psaných značek a Ctrl+Z vrátí každé vložení; texty
uložené před 1.14 vypadají v náhledu stejně jako dřív; rozepsaný text se neztratí Esc ani pádem programu.

### 1.15 – Editor II: rozhovory, jeden editor všude, sken a pravopis

**Cíl:** přepis rozhovorů bez psaní značek, stejný editor u všech textů, předloha vedle textu a podtržené překlepy.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Rozhovory a šablony | Šablona podle rubriky na kliknutí (Playboy Interview, 20 otázek, Advisor, Povídka); mluvčí z textu, po odpovědi „Další: PLAYBOY: (Tab)“, Alt+M přepne mluvčího | S–M |
| 2 | Jeden editor všude | Texty alb, poznámky modelek a čísel; malá varianta lišty, stejné zkratky; nápověda a přehled zkratek doplněné | S–M |
| 3 | Sken vedle textu | V celém okně článku panel Předloha se skeny stran (přiblížení, Alt+PageUp/PageDown bez opuštění textu); výpočet stran sdílený s čtečkou; bez připojení „Nenačteno“ | M |
| 4 | Kontrola pravopisu | cgo `webkit_web_context_set_spell_checking_enabled` (cs_CZ, en_US), `EnableDefaultContextMenu` jen pro návrhy v textových polích, `spellcheck` po polích; `instalovat.sh` a README: `hunspell-cs`, `hunspell-en`; ověřit na Fedoře | S–M |

**Hotovo, když:** rozhovor o deseti otázkách jde přepsat bez jediné ručně psané značky; články, alba
i poznámky mají stejný editor a zkratky; čtyřstránkový článek jde přepsat se skenem vedle bez myši;
překlep je podtržený a pravé tlačítko nabídne opravu.

### 1.16 – Texty III: propojení a hledání v textu

**Cíl:** články propojené s profily a pohodlné opravy přepisů. Bez změny schématu i exportu (vše v textu).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Jména modelek v textu | `[[Jméno]]` a `[[Jméno\|text]]` jako odkaz na profil (volba `modelky` ve `formatMarkdown`), našeptávač po `[[`, neznámé jméno varuje; v profilu „Zmínky v článcích“ přes `texty_fts` | M |
| 2 | Najít a nahradit | Ctrl+F / Ctrl+H v editoru, bez ohledu na diakritiku a velikost, „Nahradit vše“ vratné Ctrl+Z | S–M |
| 3 | Zvýraznění z hledání | Článek otevřený z hledání zvýrazní hledaná slova (`zvyraznit`), F3 další výskyt, Esc zruší | S |
| 4 | Typografie | „Upravit typografii“: české uvozovky, pomlčka, tři tečky; v náhledu a čísle nezlomitelné mezery za jednopísmennými předložkami | S |

**Hotovo, když:** jméno modelky v rozhovoru otevře její profil a profil ukáže články, které ji zmiňují;
opakovaná chyba přepisu jde opravit v celém textu jedním nahrazením a vrátit.

### 1.17 – Obsah čísla a tisk

**Cíl:** rychle zapsat obsah celého čísla a článek vytisknout nebo uložit jako PDF. Bez změny schématu i exportu.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Zápis obsahu najednou | Na stránce čísla „Zapsat obsah…“: řádky „27 Playboy Interview: Jimmy Carter“ → náhled → články bez textu; v obsahu čísla štítek přepis / shrnutí / bez textu | M |
| 2 | Tisk a PDF | „Vytisknout článek…“: `@media print` jen s článkem, dialog GTK (PDF přes „Tisk do souboru“); když tisk ve WebKitGTK nefunguje, HTML do `~/.cache` a otevření v prohlížeči | S–M |
| 3 | Rozpracované přepisy (volitelně) | Filtr Údržby: články bez textu a přepisy pod 300 slov | S |

**Hotovo, když:** obsah čísla s deseti články jde zapsat jedním vložením; článek jde uložit jako PDF se
stejnou sazbou jako v programu.

### 1.18 – Kontrola 2.1: učení z rozhodnutí

**Cíl:** Kontrola ladí prahy podle toho, co uživatel opravuje a co označí „V pořádku“. Bez změny schématu
i exportu. Navrženo po 1.15 – až 1.10 nasbírá aspoň 10 událostí u tří pravidel.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Učení z rozhodnutí | Přesnost pravidla (Beta) jako šance v jistotě, ladění k (4,0–6,0), α kombinací a prahu jmen (0,93–0,98) po krocích v mezích; „Kontrola se naučila: …“, Zapomenout naučené | M |
| 2 | Jména podle období | Podobnost jmen upravená podle vzdálenosti prvních vydání | S |
| 3 | Mezipaměť učení | Výsledek učení do další změny dat | S |

**Hotovo, když:** po 30 simulovaných rozhodnutích jsou prahy posunuté správným směrem a v mezích; „Zapomenout
naučené“ vrátí výchozí stav; kontrola 5 000 modelek do 120 ms.

### 1.19 – Přístupnost

**Cíl:** pohodlné čtení a ovládání bez myši a se čtečkou obrazovky. **Bez změny schématu i exportu.**

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Přiblížení | `Ctrl` + `+` / `-` / `0` a ⋯ → Vzhled: 90–150 %, uložené v `nastaveni`; snímky všech pohledů při 150 % a v úzkém okně | S–M |
| 2 | Popisky | `aria-label` u křížků oken, srdíčka jako skupina s `aria-pressed`, viditelný fokus u štítků; ověření Orcou na Fedoře | S |

**Hotovo, když:** při 150 % žádný pohled nepřetéká; Orca přečte okna, srdíčka i tlačítka srozumitelně česky.

### 1.20 – Wikidata I: návrh údajů u modelky

**Rozhodnuto 23. 10. 2026:** jde to – Wikidata se ptají jen na kliknutí a každý údaj uživatel potvrdí (viz Nedělat).

**Cíl:** chybějící údaje modelky doplnit z Wikidat (CC0) jen na kliknutí a s potvrzením každého údaje.
Bez změny schématu i exportu: původ = odkaz na položku Wikidat v Odkazech, odmítnuté hodnoty v `nastaveni`.
Před prvním krokem prototyp mimo hlavní větev: pokrytí 40 modelek 1953–1977, QID ocenění, odpovědi do
`testdata/wikidata/`; pod 50 % pokrytí dat narození se nepokračuje.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Klient a porovnání | `wikidata.go`: vyměnitelná `stahnoutWikidata`, `User-Agent` s verzí, `maxlag`, `Retry-After`, mezipaměť v `~/.cache/playboy-app/wikidata/` (30 dní), převod přesnosti data, jednotek a státu; ⋯ → „Porovnat s Wikidaty…“ u modelky s odkazem na Wikipedii, zatím jen ke čtení | M |
| 2 | Spárování | Kandidáti (`wbsearchentities`), skóre (měsíc centerfoldu, datum narození, jméno, popis), rozporné datum vylučuje; jistá / možná (výběr osoby) / žádná (vložit QID) | M |
| 3 | Převzetí po polích | Zaškrtnutí po polích (prázdné ano, rozdíl ne s ⚠, mimo rozsah Kontroly ne), uložení přes `UpdateModelka` s Vrátit, řádek Wikidat do Odkazů, odmítnuté se znovu nenabízí; i v okně „Doplnit modelku“ | M |

**Hotovo, když:** u 20 zkušebních modelek návrh odpovídá Wikipedii, nic se neuloží bez potvrzení, bez
připojení volba ohlásí výpadek a nic nezmění.

### 1.21 – Wikidata II: hromadně a pro další rok

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Katalog playmate | Jeden dotaz SPARQL na všechny Playmate měsíce a roku s datem, uložený v mezipaměti (obnova na kliknutí); párování podle měsíce centerfoldu; s katalogem fungují návrhy i offline | S–M |
| 2 | Filtr „Z Wikidat“ | „Zjistit návrhy pro N modelek bez data narození“, postup s pozastavením (nejvýš 1 dotaz/s), fronta návrhů, „Projít…“ a „Přijmout vše bez ⚠“ (jen jisté shody a prázdná pole), Vrátit dávky; skupina „Rozdíly“ jen k posouzení | M |
| 3 | Příprava dalšího roku | U měsíce bez centerfoldu v kalendáři a ročníku „Podle Wikidat: jméno“ → formulář nové modelky s předvyplněným jménem, datem narození a vydáním; uloží se jen tlačítkem Uložit | S–M |

**Hotovo, když:** dávka 100 modelek bez data narození doběhne bez chyby 429 a přijetí návrhů jde vrátit;
u roku 1978 kalendář ukáže jména pro prázdné měsíce a nic se nezaloží bez formuláře.

## Řada 2.x – Chytrá sbírka

Strojové učení a malé neuronové sítě jako jeden milník: hledání, podobnost, doporučení, postřehy, mapa sbírky.
Vše v programu, bez internetu a bez velkých modelů; každá chytrá funkce jen navrhuje a ukáže proč. Bez změny
schématu i exportu, pokud verze neříká jinak. Návrhy v `docs/` používají původní čísla verzí (převod je
v tabulce výše).

### 2.0 – Chytré hledání I: synonyma, našeptávač, učení z otevíraných

**Cíl:** hledání najde i jinak zapsané hodnoty, při psaní nabízí hodnoty ze sbírky a učí se z toho, co uživatel
otevírá; vše v programu, naučené údaje v tabulce `nastaveni`.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Synonyma I | Výchozí slovník („blond“ = „blonde“ = „plavá“, národnosti cs/en) v hledání Go i JS, štítek „(+N)“; společné testovací případy hledání pro Go i JS; měření hledání na 5 000 modelkách | M |
| 2 | Našeptávač II | Hodnoty všech polí ze sbírky s počty (i bez klíče, i „z výsledků“), roky z dat, historie vlastních hledání | M |
| 3 | Učení z otevíraných výsledků | Co po hledání otevíráš, jde příště výš (našeptávač, řazení Relevance); jen v počítači, jde zapomenout | M |
| 4 | Synonyma II | Návrhy synonym ze sbírky k potvrzení (z oprav české věty po 2.1) v ⋯ → Hledání → Synonyma | S–M |

**Hotovo, když:** společné testy hledání dávají v Go i JS stejný výsledek; našeptávač odpoví do 30 ms na 5 000
modelkách; po třech otevřeních je modelka u stejného dotazu první, „Zapomenout“ vrátí původní pořadí.

### 2.1 – Chytré hledání II: česká věta a Síť slov

**Cíl:** hledání rozumí běžné české větě a převede ji na viditelný filtr (`pole:hodnota`), který jde upravit;
tvary slov pozná malá neuronová síť.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Česká věta I | „blondýnky z 90. let bez tetování“ → `vlasy:blond rok:1990..1999 tetovani:ne`; lehký stemming, čísla a rozsahy („vyšší než 175“, „narozené po 1980“), negace; řádek „Rozumím:“ se štítky, Tab převede, Ctrl+Enter hledá doslova | M–L |
| 2 | Česká věta II | Národnosti a fotografové ze sbírky se skloňováním, volba významu u dvojznačných slov, „Vždy takto“; 50 testovacích vět | M |
| 3 | Síť slov I – jádro a měření | Malá znaková síť v čistém Go (hašované n-gramy 1–4 znaků, skrytá vrstva 32, softmax přes `pole:hodnota`), data generovaná z hodnot sbírky, vzorů skloňování a šablon vět, základní váhy v programu (~60 kB); ruční sada 150 dotazů, srovnání se stemmingem | M–L |
| 4 | Síť slov II – v hledání a učení v programu | Odhad v JS (< 0,05 ms na slovo) jako druhá vrstva `veta.js` po pravidlech a přesné shodě; štítek „≈“ s jistotou a třemi významy, pod prahem jen „Myslíš…?“, jména se nepřevádí; zlatý test Go = JS; Přeučení na pozadí po změně hodnot sbírky (ne po nových jménech), opravy „Vždy takto“ jako příklady, pojistka proti zhoršení, váhy v `nastaveni`, ⋯ → Hledání → Síť slov | M–L |

**Nedělá se:** hledání podle obsahu fotky, velký jazykový model (API ani místní), přepisování dat podle synonym.

**Hotovo, když:** z 50 testovacích vět je ≥ 45 převedeno správně a žádné jméno se nepřevede; každý převod je
vidět a jde vrátit; Síť slov: z ručních 150 dotazů ≥ 88 % neznámých tvarů správně, odhad pod 1 ms na slovo, zapne
se jen když na neznámých tvarech porazí stemming o ≥ 10 bodů; stejná data dají stejné váhy. Rozbor: [NAVRH-SITE.md](docs/NAVRH-SITE.md).

### 2.2 – Podobné modelky, „jako X“ a Tento den v historii

**Cíl:** sbírka nabídne podobné modelky v profilu i v hledání a sama připomene výročí. Podobnost je společný
`podobnost.go` (používá ho i kontrola duplicit, doporučení a Mapa sbírky).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | „Jako X“ | `jako:"jméno"` najde podobné modelky (postava, vlasy, období, kategorie) s důvody, řazení Podobnost, „Podobné →“ v profilu; kód podobnosti sdílený s kontrolou duplicit | M |
| 2 | Tento den v historii | Karta na úvodu Přehledu: kulatá výročí centerfoldů, obálek a českých čísel v tomto měsíci (10, 20, 25, 30… let), ostatní centerfoldy měsíce jako roky, narozeniny dnes a do 7 dní (jen úplné datum, ne u zemřelých); výpočet v rozhraní z dat úvodu, prázdný stav s nejbližším výročím | S |
| 3 | Podobné modelky | Pod profilem 6 karet s důvodem (období, vlasy, postava, fotograf); `PodobneModelky` ze společného `podobnost.go` (stejná funkce jako `jako:` v kroku 1), chybějící údaje se nepočítají | M |

**Hotovo, když:** `jako:"jméno"` vrátí podobné modelky s důvody a přidá nejvýš 10 ms na 5 000 modelkách; profil
ukáže podobné s důvodem a „Další podobné →“ otevře hledání `jako:`; úvod v den narozenin modelky ji ukáže s věkem.

### 2.3 – Mohlo by se ti líbit

**Cíl:** program se z hodnocení naučí vkus uživatele a pomáhá s hodnocením: navrhne srdíčka u nově přidané
modelky, upozorní na nesoudržné hodnocení a nabídne fotky, které by se mohly líbit – vždy s důvodem. Jen
z vlastních hodnocení a údajů sbírky (ne z obsahu fotek), vše v počítači. **Bez změny schématu i exportu.**
Rozbor možností: [NAVRH-DOPORUCENI.md](docs/NAVRH-DOPORUCENI.md).

**Upraveno podle skutečného používání (říjen 2026):** uživatel hodnotí **všechny** modelky (i jedním srdíčkem),
přidává je po letech (nyní kolem 400 modelek, rok 1977, desítky denně) a fotky hodnotí jen ty, které se mu
vyloženě líbí. Proto: u modelek nejsou „nehodnocené k doporučení“ – odhad slouží jako návrh u nové modelky
a ke kontrole soudržnosti; u fotek je hodnocení jen kladný signál (neohodnocená ≠ nelíbí se), takže se fotky
řadí učením z kladných příkladů. Model se učí jen z let, která sbírka má; období je příznak a odhad u modelek
z let, která ještě nejsou ve sbírce, se označí jako nejistý.

**Rozhodnutí:** hřebenová regrese odhadu srdíček modelek v čistém Go (Cholesky z `kontrola_uceni.go`) smíchaná
s kNN nad hodnocenými; u fotek skóre „podobné fotkám, které sis označil“ (učení z kladných a neoznačených
příkladů, neoznačené s nízkou vahou); podobnost ze společného `podobnost.go`.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Návrh srdíček u nové modelky | `doporuceni.go`: příznaky, ridge + kNN, λ křížovou validací; po vyplnění údajů ve formuláři a v profilu nové modelky „Odhad ♥♥♥♥ – podobná X, Y“, potvrzení jedním klikem (nikdy se nezapíše samo); u let mimo sbírku „nejisté“; MAE na vlastních hodnoceních | M–L |
| 2 | Soudržnost hodnocení | Modelky, jejichž srdíčka se nejvíc liší od odhadu z podobných („♥♥, podobné mají ♥♥♥♥“), jako volitelný filtr v Údržbě nebo seznam v ⋯ → Doporučení; posun měřítka v čase (průměr srdíček podle měsíce přidání); nic se nemění samo | M |
| 3 | Fotky, které by se ti mohly líbit | Kladné příklady = ohodnocené fotky, neoznačené jako neznámé; příznaky (typ alba, fotograf, hodnocení modelky, poloha v albu, období); mozaika v Nejlepších (max. 3 z alba) s důvodem, „Nezajímá mě“ (v `nastaveni`), řazení „Mohlo by se líbit“ v albu | M |
| 4 | Jak dobře tě znám | ⋯ → Doporučení: přesnost odhadu modelek (MAE proti průměru), úspěšnost u fotek (kolik z nabídnutých sis pak označil), skryté, vypnout | S–M |

**Nedělá se teď:** malá neuronová síť – při stovkách modelek a jen kladně označených fotkách by se přeučila
a jednoduchý model ji porazí; znovu zvážit při tisících hodnocených modelek (návrh v NAVRH-DOPORUCENI.md,
oddíl 6, s pravidlem „použije se, jen když průkazně vyhraje“). Dál se nedělá: obsah obrázku, automatické
hodnocení odhadem, učení z otevírání profilů, etnicita jako příznak.

**Hotovo, když:** na skutečné sbírce je odhad srdíček o ≥ 10 % přesnější (MAE) než průměr uživatele a každý
návrh má důvod; z fotek nabídnutých jako „mohly by se líbit“ si uživatel označí výrazně víc než z náhodných
fotek stejných alb; stejná data dají stejný výsledek; přepočet 2 000 modelek < 50 ms; schéma a export se nemění.

### 2.4 – Postřehy ve Statistikách

**Cíl:** Statistiky samy najdou a česky popíšou, co je ve sbírce průkazné – trend, zlom, čím se liší výběr –
a zamlčí náhodu. Nejvýš 5 postřehů nad grafem, klik ukáže odpovídající graf. Počítá se v rozhraní
(`lib/statistika.js`, `lib/postrehy.js`) ze stejných dat a definic jako grafy. **Bez změny schématu i exportu.**
Každý krok vyjde jako samostatná verze (2.4.0–2.4.4). Rozbor možností: [NAVRH-POSTREHY.md](docs/NAVRH-POSTREHY.md).

**Rozhodnutí:** neparametrické testy (Kendall, Cochran–Armitage, Mann–Whitney, Fisher, Spearman) s opravou
Benjamini–Hochberg a prahem podstatné velikosti; zlomy optimálním rozdělením s minimální délkou úseku 5 let;
výpočet v JS (testy výběru jsou funkce rozhraní), žádná p-hodnota v hlavní větě.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Trend u grafu | Statistické funkce s testy proti R/SciPy; věta pod grafem v čase („Výška průkazně roste: ze 168 na 173 cm“) s bublinou podrobností | M |
| 2 | Zlomy | Optimální rozdělení řady let (min. 5 let a 30 modelek, nejvýš 3 zlomy), pokuta kalibrovaná simulací; čárkovaná svislice a úrovně období v grafu, věta „Od roku 1995 roste…“ | M–L |
| 3 | Výběr proti sbírce | Mann–Whitney, Fisher, oprava BH, prahy podstatnosti (2 cm, 10 bodů), vyloučení příznaků určených výběrem, min. 10 modelek; panel „Výběr má o 4 cm užší pas (60 vs 64 cm)“ | M–L |
| 4 | Panel napříč grafy | Skóre síla × jistota, nejvýš 5, bez opakování příbuzných příznaků, bez blikání; klik přepne graf (u neobvyklého roku vybere rok); 5 000 modelek < 30 ms | M |
| 5 | Neobvyklé roky a souvislosti | Rok vybočující ze svého období, Spearman mezi údaji a s hodnocením („souvislost, ne příčina“), standardizace výběru podle desetiletí | M |

**Nedělá se:** jazykový model, předpovědi do budoucna, postřehy o jednotlivých modelkách, neprůkazné náznaky.

**Hotovo, když:** na nulové simulované sbírce ukáže postřeh nejvýš 5 % náhodných výběrů; zasazený zlom a rozdíl
se najdou jako první; statistické funkce souhlasí s R/SciPy; přepočet po změně výběru < 15 ms na 5 000 modelkách;
každý postřeh jde ukázat v grafu; schéma zůstává na úpravě č. 11 a export na verzi 7.

### 2.5 – Mapa sbírky

**Cíl:** celá sbírka jako mapa – blízko jsou modelky s podobnými údaji, vidět jsou období, „typy“ a neobvyklé
modelky. Body s barvou podle údaje, bublina, klik otevře profil, laso zúží ostatní grafy Statistik. Z téže malé
sítě podobnost pro „Podobné modelky“ i u neúplných údajů a druhý názor pro kontrolu neobvyklých kombinací.
Vše v čistém Go, bez knihoven, učení na pozadí za sekundy s pevným semínkem. **Bez změny schématu i exportu** –
váhy v `nastaveni`. Každý krok vyjde jako samostatná verze (2.5.0–2.5.3). Rozbor možností:
[NAVRH-SITE.md](docs/NAVRH-SITE.md).

**Rozhodnutí:** nejdřív PCA jako hotová mapa a měřítko; autoenkodér (2-D kód pro mapu, 8-D pro podobnost,
maska chybějících údajů, učení s vynecháváním) ji nahradí, jen když lépe zachová sousedy; t-SNE ne (mapa by
přeskakovala). Nové modelky umístí kodér hned, přeučení s teplým startem a zarovnáním (Procrustes) nejvýš
denně. Podobnost dál vysvětluje Gower z `podobnost.go`; chyba rekonstrukce se slučuje do `ok-neobvykle`.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Mapa PCA | `mapa.go`: příznaky (z-skóre postavy z `kontrola_uceni.go`, one-hot vlasů, očí, národnosti, kategorie, období, fotografové, masky), PCA s pevnou orientací, `GetMapaSbirky`; graf „Mapa sbírky“ ve Statistikách s barvou podle údaje, bublinou, klikem na profil a „Jak číst mapu“ | M–L |
| 2 | Autoenkodér | Společné jádro `sit.go` (Adam, L2, early stopping, pevné semínko), sítě s 2-D a 8-D kódem, ztráta jen z vyplněných údajů, učení na pozadí, váhy (~50 kB) v `nastaveni`; použije se, jen když zachová sousedy o ≥ 0,05 lépe než PCA | M–L |
| 3 | Stabilita | Nové modelky kodérem hned, teplý start při +5 % modelek, zarovnání Procrustem, míra posunu pod mapou, „Přepočítat od začátku“ | M |
| 4 | Výběr na mapě, podobnost a druhý názor | Laso jako výběr Statistik (zúží grafy a seznam), legenda jako výběr, „Na mapě →“ v profilu, canvas nad 2 000 bodů; „Sousedé na mapě“, 8-D kód jako doplněk Gowera u neúplných modelek; chyba rekonstrukce: souhlas zvýší jistotu `ok-neobvykle`, sama jen slabý nález, nikdy dva nálezy u jedné modelky | M–L |

**Nedělá se:** t-SNE, srdíčka nebo etnicita jako vstup, nové klíče `ok-…`, knihovny strojového učení, obsah fotek.

**Hotovo, když:** mapa 400 modelek se ukáže do 100 ms a zasazené skupiny umělé sbírky jsou oddělené; síť se
používá jen při průkazně lepším zachování sousedů než PCA; po přidání 30 modelek se staré body posunou o < 3 %;
žádná modelka nemá dva nálezy `ok-neobvykle`; stejná data dají stejnou mapu; 5 000 modelek: učení < 20 s na
pozadí, kresba < 50 ms; schéma zůstává na úpravě č. 11 a export na verzi 7.

### 2.6 – Stejné a podobné fotky

**Cíl:** najít stejnou fotku nahranou na Disk víckrát (jiné ID) a podobné záběry. Otisk obrázku (dHash + pHash)
z náhledů v mezipaměti z 1.3, otisky v `~/.cache/playboy-app/otisky.tsv`; bez změny schématu i exportu.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Otisky | `otisky.go`: dHash a pHash v čistém Go, počítání na pozadí (4 souběžně, pauza při výpadku a 429, pokračuje po restartu), stav v Údržbě; prahy doladit na skutečné sbírce | M |
| 2 | Stejné fotky v Údržbě | Filtr „Stejné fotky“: skupiny (pásma otisku + sjednocení), náhledy vedle sebe, Odebrat s Vrátit, „V pořádku“ (v `nastaveni`) | M |
| 3 | Najít podobné a upozornění | Nabídka fotky „Najít podobné fotky“; okno duplicit při vkládání (1.4) přidá „vypadá stejně jako…“ | S |

**Hotovo, když:** stejná fotka nahraná podruhé se v Údržbě objeví jako skupina; přeuložená nebo zmenšená
kopie se najde, fotky z jiných focení ne; smazání `otisky.tsv` jen spustí přepočet.

### 2.7 – Chytré výběry **[schéma]**

**Cíl:** výběr, který se plní sám podle uloženého hledání. Úprava schématu č. 13 (`vybery.dotaz`),
export 9 (`vybery[].dotaz`).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Fotky podle dotazu v Go | `GetFotkyDotazu`: podmínky modelky přes `odpovidaHledani`, podmínky fotky (srdíčka, typ, rok, vydání, fotograf) v SQL; rozklad dotazu sdílený s chytrým hledáním (2.0–2.1) | M |
| 2 | Schéma a export | Sloupec `dotaz`, přechod, export a import, test zmrazení a přechodu ze starých verzí | S–M |
| 3 | Rozhraní | „Uložit jako chytrý výběr…“ v Nejlepších, čip s ⚡, upravit dotaz, zmrazit (zkopírovat fotky do ručního výběru) | S |

**Hotovo, když:** nová fotka splňující dotaz se ve výběru objeví bez zásahu; export → import chytrý výběr
zachová; starší program novější export odmítne srozumitelnou hláškou.

### 2.8 – Kvíz „Poznej playmate“

**Cíl:** hra nad vlastní sbírkou. Bez změny schématu i exportu (statistiky v `nastaveni`).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Kdo je to? | Část Přehledu „Kvíz“: titulní fotka a 4 jména, lehká (náhodná) a těžká (podobné modelky z 2.2), okruh podle desetiletí a oblíbených, klávesy 1–4, Enter, Esc | M |
| 2 | Kdy? a Playmate měsíce | Rok nebo měsíc k fotce či jménu (body za přesnost), „Kdo byla Playmate 06/1995?“; bez připojení jen režimy bez fotky | S–M |
| 3 | Statistiky a opakování | `GetKviz`/`SetKviz` (JSON v `nastaveni`), úspěšnost, série, Leitnerovy krabičky – častěji modelky, které uživatel plete | S |

**Hotovo, když:** deset otázek jde odehrát jen klávesnicí; po hře je seznam chyb s odkazy na profil;
statistiky přežijí restart i obnovení ze zálohy.

Rozbor možností k 2.2, 2.6–2.8 a k Wikidatům: [NAVRH-NAPADY.md](docs/NAVRH-NAPADY.md).

### Rezerva – jen když se ukáže potřeba

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Rychlé hodnocení v kartách | Srdíčka na kartách modelek a dlaždicích fotek jdou nastavit kolečkem myši nad srdíčky (ověřit, že nekoliduje s rolováním) – jen pokud se v používání ukáže potřeba | S |
| 2 | „Mám PDF“ u americké edice **[schéma]** | Jen pokud se ukáže potřeba: stav čísla US „mám PDF“ (a cesta nebo odkaz na soubor), filtr a barva v mapě americké edice; nejbližší volná úprava schématu a verze exportu | S–M |


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
- Google Disk: zobrazování zůstává přes sdílené odkazy, Google API přibude jen pro výběr fotek v programu (1.3).
- Malé náhledy smí program ukládat na disk jako mezipaměť (1.6); originály a velké fotky zůstávají jen na Disku.
- 1.0.0 po 14 dnech používání bety bez nové chyby (21. 10. 2026); po 1.0.0 MINOR pro téma z plánu, PATCH pro
  každý krok a opravu v tématu (1.3.0, 1.3.1…); MAJOR = velký milník (2.x Chytrá sbírka), kompatibilitu dat hlídá
  verze schématu a exportu (revize plánu 23. 10. 2026).
- Google Disk v aplikaci (1.3–1.4): doporučený rozsah `drive.file` s výběrem Google v prohlížeči a vlastním projektem
  uživatele v Google Cloud – potvrdí se po prototypu (1.3, krok 1).
- Editor textů (1.14–1.15): vlastní lišta nad markdownem s náhledem, žádná knihovna editoru.
- Revize řady 1.x (23. 10. 2026, potvrzeno uživatelem): nejdřív Rychlé přidávání (1.1) a Přidat číslo (1.2), pak
  Google Disk; Vrátit přidání v 1.2 jen pro právě přidané číslo (cílené, ne deník změn); upozornění na novou
  verzi v 1.8 kontrolou repozitáře (`git fetch`), nic se samo neinstaluje; „Naposledy upravené“ u modelky jako
  sloupec v úpravě č. 12 (1.9), plná historie změn ne; Disk: záložní adresa obrázků v 1.6 (Náhledy), výchozí
  limit náhledů 2 GB, přihlášení přes `golang.org/x/oauth2`; Wikidata (1.20–1.21) jen na kliknutí a s potvrzením
  každého údaje.

## Nedělat

- Obecné Zpět pro všechny úpravy (deník změn) – denní zálohy, Vrátit u fotek a Vrátit přidání čísla (1.2) stačí.
- Místní kopie fotek v plné velikosti (malé náhledy jako mezipaměť ano, viz 1.6), zálohy na jiný disk.
- Šifrovanou databázi – zvolen zámek rozhraní.
- Půlsrdíčka.
- Zobrazování fotek přes Google API s přihlášením (API jen k výběru fotek, viz 1.3–1.4); automatický import celé
  složky bez výběru, automatické stahování a zápis údajů z webu bez potvrzení (Wikidata 1.20–1.21 jen na kliknutí
  a s potvrzením každého údaje), rozpoznávání obličejů.
- Nové funkce v alfě a betě a změny schématu nebo exportu od alfy.
- Vše z oddílu „Rozhodnuto nedělat“ v `PLAN.md`.
