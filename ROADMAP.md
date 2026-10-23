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
modelek po kliknutí (0.92.x) výskyt modelky v časopise nebo jen online (0.93.0) spojení Čísel s Kalendářem (0.94.0) a Statistiky jako jeden graf se seznamem modelek (0.95.0, 0.96.0, 0.98.0) Kontrola s pravidly a „V pořádku“ (0.97.0) a části Přehledu v nabídce tlačítka Přehled (0.99.x) přibyly 22. 10. 2026 na přání uživatele ještě před 1.0; schéma ani formát exportu
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
| 1.9 | Chytré hledání – česká věta jako filtr, našeptávač, učení z otevíraných výsledků, „jako X“, synonyma | – |
| 1.10 | Tento den v historii, podobné modelky v profilu | 1.9 |
| 1.11 | Stejné a podobné fotky (otisk obrázku) | 1.5 |
| 1.12 | Wikidata I – návrh údajů u modelky | – (rozhodnutí) |
| 1.13 | Wikidata II – hromadně v Údržbě | 1.12 |
| 1.14 | Chytré výběry **[schéma]** | 1.9 |
| 1.15 | Kvíz „Poznej playmate“ | 1.10 |
| 1.16 | Kontrola 2.0 – postava podle období, jistota a řazení nálezů, učení z oprav i „V pořádku“ | – (rozšiřuje 1.6, jde hned po ní) |
| 1.17 | Mohlo by se ti líbit – odhad srdíček z vlastních hodnocení, doporučené modelky a fotky, „Ohodnoť další“, volitelně malá neuronová síť | 1.10, 1.9.1 |
| 1.18 | Postřehy ve Statistikách – trendy, zlomy, výběr proti sbírce, neobvyklé roky | – |
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

### 1.9 – Chytré hledání (strojové učení nad sbírkou)

**Cíl:** hledání rozumí běžné češtině a učí se ze sbírky a z používání – vše v programu, bez internetu
a bez velkých modelů. Každá chytrá funkce se převádí na dnešní cílené hledání (`pole:hodnota`), které je vidět
a jde upravit. **Bez změny schématu i exportu** – naučené údaje jsou v tabulce `nastaveni`. Každý krok vyjde
jako samostatná verze (1.9.0–1.9.6). Rozbor možností: [NAVRH-HLEDANI.md](docs/NAVRH-HLEDANI.md).

**Rozhodnutí:** pravidla a slovník z hodnot sbírky místo klasifikátoru nebo jazykového modelu (průhledné,
testovatelné, offline); podobnost modelek váženou vzdáleností nad údaji, sdílenou s kontrolou v Údržbě.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Synonyma I | Výchozí slovník („blond“ = „blonde“ = „plavá“, národnosti cs/en) v hledání Go i JS, štítek „(+N)“; společné testovací případy hledání pro Go i JS; měření hledání na 5 000 modelkách | M |
| 2 | Našeptávač II | Hodnoty všech polí ze sbírky s počty (i bez klíče, i „z výsledků“), roky z dat, historie vlastních hledání | M |
| 3 | Česká věta I | „blondýnky z 90. let bez tetování“ → `vlasy:blond rok:1990..1999 tetovani:ne`; lehký stemming, čísla a rozsahy („vyšší než 175“, „narozené po 1980“), negace; řádek „Rozumím:“ se štítky, Tab převede, Ctrl+Enter hledá doslova | M–L |
| 4 | Česká věta II | Národnosti a fotografové ze sbírky se skloňováním, volba významu u dvojznačných slov, „Vždy takto“; 50 testovacích vět | M |
| 5 | „Jako X“ | `jako:"jméno"` najde podobné modelky (postava, vlasy, období, kategorie) s důvody, řazení Podobnost, „Podobné →“ v profilu; kód podobnosti sdílený s kontrolou duplicit | M |
| 6 | Učení z otevíraných výsledků | Co po hledání otevíráš, jde příště výš (našeptávač, řazení Relevance); jen v počítači, jde zapomenout | M |
| 7 | Synonyma II | Návrhy synonym ze sbírky a z oprav k potvrzení v ⋯ → Hledání → Synonyma | S–M |

**Nedělá se:** hledání podle obsahu fotky, jazykový model (API ani místní), přepisování dat podle synonym.

**Hotovo, když:** z 50 testovacích vět je ≥ 45 převedeno správně a žádné jméno se nepřevede; každý převod je
vidět a jde vrátit; našeptávač odpoví do 30 ms a `jako:` přidá nejvýš 10 ms na 5 000 modelkách; po třech
otevřeních je modelka u stejného dotazu první; schéma zůstává na úpravě č. 11 a export na verzi 7.

### 1.10 – Tento den a podobné modelky

**Cíl:** sbírka sama připomene výročí a nabídne podobné modelky. Bez změny schématu i exportu.
Podrobně: [NAVRH-NAPADY.md](docs/NAVRH-NAPADY.md), nápady 3 a 4.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Tento den v historii | Karta na úvodu Přehledu: kulatá výročí centerfoldů, obálek a českých čísel v tomto měsíci (10, 20, 25, 30… let), ostatní centerfoldy měsíce jako roky, narozeniny dnes a do 7 dní (jen úplné datum, ne u zemřelých); výpočet v rozhraní z dat úvodu, prázdný stav s nejbližším výročím | S |
| 2 | Podobné modelky | Pod profilem 6 karet s důvodem (období, vlasy, postava, fotograf); `PodobneModelky` ze společného `podobnost.go` (stejná funkce jako `jako:` z 1.9), chybějící údaje se nepočítají | M |

**Hotovo, když:** úvod v den narozenin modelky ji ukáže s věkem; profil modelky s vyplněnými údaji ukáže
podobné s důvodem a „Další podobné →“ otevře hledání `jako:`.

### 1.11 – Stejné a podobné fotky

**Cíl:** najít stejnou fotku nahranou na Disk víckrát (jiné ID) a podobné záběry. Otisk obrázku (dHash + pHash)
z náhledů v mezipaměti z 1.5, otisky v `~/.cache/playboy-app/otisky.tsv`; bez změny schématu i exportu.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Otisky | `otisky.go`: dHash a pHash v čistém Go, počítání na pozadí (4 souběžně, pauza při výpadku a 429, pokračuje po restartu), stav v Údržbě; prahy doladit na skutečné sbírce | M |
| 2 | Stejné fotky v Údržbě | Filtr „Stejné fotky“: skupiny (pásma otisku + sjednocení), náhledy vedle sebe, Odebrat s Vrátit, „V pořádku“ (v `nastaveni`) | M |
| 3 | Najít podobné a upozornění | Nabídka fotky „Najít podobné fotky“; okno duplicit při vkládání (1.3) přidá „vypadá stejně jako…“ | S |

**Hotovo, když:** stejná fotka nahraná podruhé se v Údržbě objeví jako skupina; přeuložená nebo zmenšená
kopie se najde, fotky z jiných focení ne; smazání `otisky.tsv` jen spustí přepočet.

### 1.12 – Wikidata I: návrh údajů u modelky

**Cíl:** chybějící údaje modelky doplnit z Wikidat (CC0) jen na kliknutí a s potvrzením každého údaje.
Bez změny schématu i exportu: původ = odkaz na položku Wikidat v Odkazech.

**Rozhodnutí před začátkem:** bod Nedělat „stahování údajů z webu“ upřesnit na „automatické stahování
a zápis údajů z webu“.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Prototyp a pokrytí | Kolik playmate má na Wikidatech ocenění s měsícem, datum narození, výšku; QID ocenění; ověřit `User-Agent`, odpovědi v `testdata/wikidata/` | S |
| 2 | Spárování a převod | `wikidata.go`: kandidáti (`wbsearchentities`, odkaz na Wikipedii v Odkazech), skóre (měsíc centerfoldu, datum narození, jméno), převod přesnosti data, jednotek, státu na hodnoty sbírky; mezipaměť v `~/.cache/playboy-app/wikidata/` | M |
| 3 | Okno návrhu | V profilu a v „Doplnit modelku“: údaje vedle sebe, zaškrtnutí po polích (prázdné ano, rozdíl ne s ⚠), Jiná osoba…, uložení s Vrátit; odmítnuté hodnoty se znovu nenabízí | M |

**Hotovo, když:** u 20 zkušebních modelek návrh odpovídá Wikipedii, nic se neuloží bez potvrzení, bez
připojení volba ohlásí výpadek a nic nezmění.

### 1.13 – Wikidata II: hromadně v Údržbě

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Katalog playmate | Jeden dotaz SPARQL na všechny Playmate měsíce a roku s datem; párování podle měsíce centerfoldu | S–M |
| 2 | Filtr „Z Wikidat“ | „Zjistit návrhy pro N modelek bez data narození“, postup s pozastavením (nejvýš 1 dotaz/s), fronta návrhů, „Projít…“ a „Přijmout vše bez ⚠“ | M |

**Hotovo, když:** dávka 100 modelek bez data narození doběhne bez chyby 429 a přijetí návrhů jde vrátit.

### 1.14 – Chytré výběry **[schéma]**

**Cíl:** výběr, který se plní sám podle uloženého hledání. Úprava schématu č. 13 (`vybery.dotaz`),
export 9 (`vybery[].dotaz`).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Fotky podle dotazu v Go | `GetFotkyDotazu`: podmínky modelky přes `odpovidaHledani`, podmínky fotky (srdíčka, typ, rok, vydání, fotograf) v SQL; rozklad dotazu sdílený s 1.9 | M |
| 2 | Schéma a export | Sloupec `dotaz`, přechod, export a import, test zmrazení a přechodu ze starých verzí | S–M |
| 3 | Rozhraní | „Uložit jako chytrý výběr…“ v Nejlepších, čip s ⚡, upravit dotaz, zmrazit (zkopírovat fotky do ručního výběru) | S |

**Hotovo, když:** nová fotka splňující dotaz se ve výběru objeví bez zásahu; export → import chytrý výběr
zachová; starší program novější export odmítne srozumitelnou hláškou.

### 1.15 – Kvíz „Poznej playmate“

**Cíl:** hra nad vlastní sbírkou. Bez změny schématu i exportu (statistiky v `nastaveni`).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Kdo je to? | Část Přehledu „Kvíz“: titulní fotka a 4 jména, lehká (náhodná) a těžká (podobné modelky z 1.10), okruh podle desetiletí a oblíbených, klávesy 1–4, Enter, Esc | M |
| 2 | Kdy? a Playmate měsíce | Rok nebo měsíc k fotce či jménu (body za přesnost), „Kdo byla Playmate 06/1995?“; bez připojení jen režimy bez fotky | S–M |
| 3 | Statistiky a opakování | `GetKviz`/`SetKviz` (JSON v `nastaveni`), úspěšnost, série, Leitnerovy krabičky – častěji modelky, které uživatel plete | S |

**Hotovo, když:** deset otázek jde odehrát jen klávesnicí; po hře je seznam chyb s odkazy na profil;
statistiky přežijí restart i obnovení ze zálohy.

Rozbor možností k 1.10–1.15: [NAVRH-NAPADY.md](docs/NAVRH-NAPADY.md). Wikidata (1.12–1.13) čekají na rozhodnutí
uživatele: odporují bodu „stahování údajů z webu“ v oddílu Nedělat.

### 1.16 – Kontrola 2.0

**Cíl:** kontrola v Údržbě porovnává modelky se stejnou dobou, řadí nálezy podle jistoty chyby a učí se
z oprav i z „V pořádku“. **Bez změny schématu i exportu** – naučené počty jsou v tabulce `nastaveni`.
Každý krok vyjde jako samostatná verze (1.16.0–1.16.4). Rozbor možností: [NAVRH-KONTROLA2.md](docs/NAVRH-KONTROLA2.md).
Rozšiřuje 1.6 a nezávisí na 1.7–1.15, takže jde vzít hned po 1.6.

**Rozhodnutí:** klouzavé okno ±5 let podle prvního vydání přitažené k celé sbírce (ne desetiletí ani regrese);
jistota = šance pravidla × vzácnost hodnoty (ne naučený klasifikátor); opravy se poznají ze snímku ukázaných
nálezů v `nastaveni` (ne deník změn); prahy se ladí po malých krocích v pevných mezích, tvrdá pravidla nikdy.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Postava podle období | Měření na kopii sbírky; medián a σ po rocích (okno ±5 až ±15 let, ≥ 40 hodnot), přitažení k celé sbírce w = n/(n+40), z-skóre kombinací vůči období s korelací z celé sbírky; text „kolem roku 1962 obvykle …“ | M–L |
| 2 | Jistota a řazení | `Jistota` v nálezu z vzácnosti hodnoty (t-rozdělení, χ², podobnost jmen) a přesnosti pravidla; „skoro jistě překlep“ / „možná chyba“; Kontrola řazená podle jistoty; slabé nálezy za odkazem; „Proč je to podezřelé?“ v ⋯ | M |
| 3 | Pamatování nálezů | Otisk údajů nálezu, snímek v `nastaveni`, porovnání v `GetPrehled`: zmizelý nález se změněným údajem = opraveno, „V pořádku“ = planý poplach, hromadné změny se nepočítají; okno ⋯ → Kontrola údajů… | M |
| 4 | Učení z rozhodnutí | Přesnost pravidla (Beta), ladění k (4,0–6,0), α kombinací a prahu jmen (0,93–0,98) po krocích; řádek „Kontrola se naučila: …“, Zapomenout naučené | M |
| 5 | Návrh opravy (volitelně) | Vzory překlepů (chybějící číslice, prohozené číslice, palce, libry, prohozené obvody) s kandidátem v rozsahu období, oprava jedním klikem s Vrátit; jména podle období | M |

**Nedělá se:** nové klíče `ok-…`, deník změn, knihovny strojového učení, skrývání tvrdých pravidel.

**Hotovo, když:** pas 70 cm v roce 1962 se hlásí a v roce 2008 ne; z prvních 20 nálezů skutečné sbírky je
aspoň 15 skutečná chyba; oprava se započítá jako „opraveno“ a import ne; po 30 simulovaných rozhodnutích
jsou prahy v mezích a „Zapomenout naučené“ vrátí výchozí stav; kontrola 5 000 modelek do 120 ms; schéma
ani export se nemění.

### 1.17 – Mohlo by se ti líbit

**Cíl:** program se z hodnocení srdíčky naučí vkus uživatele a nabídne nehodnocené modelky a fotky, každou
s důvodem. Jen z vlastních hodnocení a údajů sbírky (ne z obsahu fotek), vše v počítači. **Bez změny schématu
i exportu** – model se přepočítává z dat, „Nezajímá mě“ a volby jsou v `nastaveni`. Každý krok vyjde jako
samostatná verze (1.17.0–1.17.3, volitelně 1.17.4). Rozbor možností: [NAVRH-DOPORUCENI.md](docs/NAVRH-DOPORUCENI.md).

**Rozhodnutí:** hřebenová regrese odhadu srdíček v čistém Go (Cholesky z `kontrola_uceni.go`) smíchaná s kNN nad
hodnocenými podle jejich počtu; příznaky z údajů modelky a alba (robustní z-skóre, one-hot, fotografové, štítky);
podobnost a diverzita ze společného `podobnost.go`; nehodnocené nikdy nejsou záporný příklad.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Model modelek a řazení | `doporuceni.go`: příznaky, ridge + kNN, pod 10 hodnoceními nic, váhy úrovní srdíček, λ 5násobnou křížovou validací, přepočet po změně hodnocení; řazení „Odhad ♥“ v galerii; MAE a precision@10 na vlastních hodnoceních | M–L |
| 2 | Mohlo by se ti líbit | Čip v Nejlepších: 10 modelek (7 nejlepších s penalizací podobnosti + 3 „Pro změnu“), důvody „blond · 70. léta · fotograf Pompeo Posar“ nebo „podobná X ♥5“, „Nezajímá mě“ (v `nastaveni`), odhad v profilu nehodnocené modelky | M |
| 3 | Doporučené fotky | Příznaky fotky (typ alba, fotograf, hodnocení modelky, průměr alba bez fotky, poloha, období), mozaika 60 fotek (max. 3 z alba), prohlížeč s klávesami 1–5; když nepřekoná průměr alba, použije se ten | M |
| 4 | Ohodnoť další a vyhodnocení | 12 fotek a modelek, u kterých si model je nejméně jistý (při začátku nejrozmanitější), ⋯ → Doporučení: „Jak dobře tě znám“, skryté, vypnout | M |
| 5 | Malá neuronová síť (volitelně) | Jen při ≥ 1 000 hodnocených fotek podle metrik z kroku 4: perceptron s 1 skrytou vrstvou v čistém Go (pevné semínko, Adam, L2, early stopping), ověření na pozadí; použije se, jen když je v křížové validaci o ≥ 3 % lepší v ≥ 4 z 5 záhybů, jinak zůstane jednoduchý model; váhy (~7 kB) v `nastaveni` | M–L |

**Nedělá se:** obsah obrázku (konvoluční síť, hotové obrazové modely a jejich runtime), automatické hodnocení
odhadem, učení z otevírání profilů, etnicita jako příznak.

**Hotovo, když:** na syntetické sbírce je ≥ 8 z 10 doporučení podle zasazeného vkusu; na skutečné sbírce je odhad
modelek o ≥ 10 % přesnější (MAE) než průměr uživatele a každé doporučení má důvod; stejná data dají stejný výsledek;
přepočet 2 000 modelek < 50 ms a 64 000 fotek < 300 ms; schéma a export se nemění.

### 1.18 – Postřehy ve Statistikách

**Cíl:** Statistiky samy najdou a česky popíšou, co je ve sbírce průkazné – trend, zlom, čím se liší výběr –
a zamlčí náhodu. Nejvýš 5 postřehů nad grafem, klik ukáže odpovídající graf. Počítá se v rozhraní
(`lib/statistika.js`, `lib/postrehy.js`) ze stejných dat a definic jako grafy. **Bez změny schématu i exportu.**
Každý krok vyjde jako samostatná verze (1.18.0–1.18.4). Rozbor možností: [NAVRH-POSTREHY.md](docs/NAVRH-POSTREHY.md).

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
