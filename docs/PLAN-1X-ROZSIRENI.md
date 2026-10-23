# Návrh: rozšíření řady 1.x podle denní práce

Stav k 23. 10. 2026 (verze 0.99.3, schéma úprava č. 11, export verze 7). Doplňuje řadu 1.x „Pohodlí a kvalita
dat“ v `ROADMAP.md` o témata, která tam zatím nejsou. Vychází z průchodu kódem (formuláře, nabídky, klávesnice,
zálohy, instalace), ne z obecných přání. Čísla verzí 1.12–1.16 jsou **předběžná**; doporučené místo v pořadí
je u každé verze.

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export – žádný
návrh níže schéma ani export nemění.

**Jak uživatel pracuje (říjen 2026):** ~400 modelek, přidává **desítky modelek denně** chronologicky (teď rok
1977), každé modelce dá 1–5 srdíček, fotky hodnotí jen ty, které se líbí, sbírá české výtisky (Sháním CZ),
Fedora, aktualizace `git pull` + `./instalovat.sh`.

## 1. Jak dnes vypadá přidání jedné playmate

Scénář: playmate 06/1977, ve sbírce zatím není. Centerfold (3 stránky), cover, jeden pictorial, údaje
(narození, místo, národnost, výška, váha, vlasy, oči, míry, ochlupení, tetování, piercing, typ prsou),
titulní fotka a srdíčka. Kopírování odkazů v prohlížeči se nepočítá (stejné dnes i po změnách), vložení
odkazů = 1 akce. Nejkratší cesta, kterou kód dnes nabízí (Čísla → Kalendář, rok 1977):

| # | Krok | Kde v kódu | Akce (kliky, vložení, Enter) | Psaní | Okna |
|---|---|---|---|---|---|
| 1 | Klik na prázdné 06/1977 → „Přidat centerfold…“ | `kalendar.js:335`, `nabidkaCisla` | 2 | – | – |
| 2 | Jméno (nová modelka se založí), fotograf, vložit odkazy, Uložit fotky | `formular-alba.js:15`, `ulozeni.js:203` | 3 | ~27 znaků | 1 |
| 3 | Klik na číslo → stránka čísla → „+ Pictorial“ | `vydani.js:87` | 2 | – | – |
| 4 | Jméno znovu (výběr ze seznamu), název alba, fotograf znovu, odkazy, Uložit | `ulozeni.js:203` | 4 | ~35 znaků | 1 |
| 5 | „+ Cover“ → vložit odkaz → Uložit cover | `cover.js:22` | 3 | – | 1 |
| 6 | „Upravit číslo…“ → pole Na obálce → jméno znovu → Uložit | `vydani.js:332` | 4 | ~5 znaků | 1 |
| 7 | Jméno v čísle → profil → ⋯ na centerfoldu → „Nastavit jako titulní fotku“ | `akce-fotky.js:33` | 3 | – | – |
| 8 | Upravit → 12 polí přes 2 části formuláře (Tab, výběry) → Uložit modelku | `formular-modelky.js:61`, `ulozeni.js:130` | 2 + ~25× Tab | ~60 znaků | 1 |
| 9 | Klik na srdíčko v profilu | `galerie.js:284` | 1 | – | – |
| | **Celkem** | | **~24 akcí + ~25× Tab** | **~130 znaků** | **6 oken** |

Jméno modelky se píše **čtyřikrát** (centerfold, pictorial, na obálce, hledání v profilu odpadá díky odkazu),
fotograf dvakrát, vydání se předvyplní jen díky začátku v kalendáři. Při „desítkách denně“ jde o stovky kliků
a tisíce znaků denně.

**Hlavní tření (podle kódu):**

- „Uložit a přidat další“ v okně alba ponechá typ: po centerfoldu nejde rovnou pictorial, protože výběr typu je
  při daném typu schovaný (`formular-alba.js:75`) a po uložení jde kurzor znovu do odkazů centerfoldu
  (`ulozeni.js:251`).
- Okno coveru nezná modelku z obálky; ta se zadává zvlášť v „Upravit číslo…“ (`cover.js`, `vydani.js:400`).
- Nová modelka nemá titulní fotku, dokud ji uživatel ručně nevybere; karta ukazuje „Bez fotky“
  (`obrazky.js:30`) a Údržba ji hlásí jako úkol.
- Okno „Nová modelka“ po uložení vždy otevře profil (`formular-modelky.js:245`); pro řadu jmen není „Přidat
  a další“.
- Bez začátku v kalendáři se vydání nevyplní (cover i centerfold z tlačítka + mají prázdný měsíc a rok).
- Klávesnice: žádná zkratka pro přidání, žádné Ctrl+Enter pro uložení okna, srdíčka modelky v profilu jen myší
  (klávesy 1–5 fungují jen na zaměřené kartě, `klavesnice.js:30`).
- Údaje se přepisují ručně z datového listu nebo Wikipedie; převod palců, liber a „36-24-35“ už existuje
  (`format.js:397–420`), ale jen po jednom poli.
- Denní záloha vzniká jen při spuštění (`app.go:739`): práce dne je zálohovaná až příští den, a když program
  běží přes noc, záloha nevznikne vůbec.

Start (0,13 s s 2 000 modelkami) a ukládání (WAL) tření nepůsobí – zrychlení startu se nenavrhuje.

## 2. Rozšíření

### R1 – Centerfold a pictorial v jednom okně

- **Co to dá:** po centerfoldu tlačítko „Uložit a přidat pictorial“: okno zůstane otevřené, typ se přepne na
  Pictorial, modelka, fotograf a vydání zůstanou. Krok 3–4: 6 akcí a ~35 znaků → 2 akce a ~16 znaků (jen název
  a odkazy).
- **Jak:** `formular-alba.js` – při `moznosti.typ === 'Centerfold'` druhé tlačítko `name="pictorial"`;
  v `ulozeni.js:248` po uložení `selectTyp.value = 'Pictorial'`, `prepnoutPoleAlba()`, předvyplnit název
  `Pictorial RRRR-MM` (vzor z placeholderu), kurzor do odkazů. Nadpis okna „Přidat pictorial“.
- **Prac.:** S. **Schéma/export:** ne. **Rizika:** žádná; název jde přepsat.

### R2 – Na obálce v okně coveru, „Uložit a další“

- **Co to dá:** pole „Na obálce“ přímo v okně coveru, předvyplněné centerfoldem téhož čísla (kdo je ve sbírce),
  jinak prázdné. Krok 6 odpadá: −4 akce, −5 znaků. Ubude i úkolů „cover bez modelky z obálky“, které přidá 1.5.
- **Jak:** `sablona.js` (coverModal) – pole s `list="seznamModelekObalky"`; `cover.js` po `AddCover`
  zavolá `SetVydaniInfo` se stávající poznámkou a stavem (načíst `GetVydaniInfo`, změnit jen
  `modelkaObalky`/`naObalce`). Předvyplnění z `GetVydani(vydani)` (centerfold čísla). „Uložit a další cover“
  posune měsíc o jeden (viz R4).
- **Prac.:** S. **Schéma/export:** ne (`vydani_info` už má modelku obálky). **Rizika:** přepsání ručně zadané
  obálky – předvyplnit jen prázdné pole.

### R3 – Titulní fotka z centerfoldu sama

- **Co to dá:** modelka bez titulní fotky dostane po uložení centerfoldu jeho první stránku. Krok 7 odpadá
  (−3 akce), karta hned ukazuje fotku, úkol „titulní fotka“ v Údržbě u nových modelek nevzniká.
- **Jak:** v Go na konci `AddBulkPhotos` (`app.go:2570`): když `typ == "Centerfold"`, něco se vložilo
  a modelka nemá `cover_drive_id`, nastavit první vloženou fotku (stejně jako `SetTitulniFotka`, výřez
  výchozí). Bez centerfoldu se použije první fotka pictorialu. Test v `app_test.go`.
- **Prac.:** S. **Schéma/export:** ne. **Rizika:** import přes `importovatFotky` jde jinou cestou, takže se
  nemění; ruční titulní fotka se nikdy nepřepíše.

### R4 – Další číslo jako výchozí

- **Co to dá:** okna centerfoldu, coveru, pictorialu a průvodce (R6) otevřená z tlačítka + bez daného čísla
  nabídnou **první číslo po posledním centerfoldu ve sbírce** zvolené edice (dnes 06/1977 → 07/1977). Uživatel
  jde chronologicky, takže výchozí hodnota skoro vždy sedí. Ušetří výběr měsíce a psaní roku (2 akce, 4 znaky)
  pokaždé, když se nezačíná v kalendáři.
- **Jak:** funkce `dalsiCislo(edice)` v `lib/format.js` nad daty `GetKalendar` (už v `stav.kalendarData`),
  přeskočí `NEVYSLA_CISLA` a respektuje `RADY_EDIC`; použije se v `otevritAlbumModal`, `otevritCoverModal`
  a v R6. Na úvodu Přehledu a v kalendáři tlačítko „Pokračovat: 07/1977 →“ (otevře R6).
- **Prac.:** S. **Schéma/export:** ne. **Rizika:** při přeskakování let nabídne „staré“ číslo – hodnota je
  jen předvyplněná a vidět.

### R5 – Klávesnice pro přidávání

- **Co to dá:** celé přidání bez myši.
- **Jak:**
  - `Ctrl+N` Nová modelka, `Ctrl+Shift+N` Přidat číslo (R6) – obsluha v `ulozeni.js` vedle Ctrl+F, ne nad
    otevřeným oknem a při zámku.
  - `Ctrl+Enter` v každém okně s formulářem = hlavní tlačítko, `Ctrl+Shift+Enter` = „… a další“.
  - Okno „Nová modelka“: tlačítko „Přidat a další“ (`Shift+Enter`) – modelka se uloží, pole se vyprázdní,
    pod polem řádek „Přidáno: Jméno ✓“ s odkazem na profil (`formular-modelky.js:233`).
  - V profilu klávesy 1–5 a 0 hodnotí modelku, když není zaměřená dlaždice fotky (`klavesnice.js:30`).
  - Přehled zkratek (`zkratky.js`) a nápověda doplněné.
- **Prac.:** S. **Schéma/export:** ne. **Rizika:** Ctrl+N nesmí kolidovat s WebKitGTK (nové okno) – ověřit
  na Fedoře, jinak `Alt+N`.

### R6 – Průvodce „Přidat číslo“

- **Co to dá:** jedno okno pro celé číslo: centerfold, cover, pictorialy, na obálce a srdíčka. Scénář z oddílu 1
  (bez údajů): ~20 akcí, ~67 znaků, 5 oken → **~8 akcí, ~27 znaků, 1 okno**; s R9 (údaje vložením) celé
  přidání **~10 akcí místo ~24** a místo ~25 Tabů žádný.
- **Jak:** nové okno `frontend/src/app/pridat-cislo.js`, v Go `pridani.go` s `PridatCislo(PridaniCisla)
  VysledekCisla`: nejdřív ověření všech souborů (`overitSoubory`, mimo transakci, kvůli síti), potom vše
  v jedné transakci (`vTransakci`): modelka (nová nebo známá), album Centerfold, fotky, cover, `vydani_info`
  (na obálce), pictorialy (`zajistitAlbum`, `SetPopisAlba`), srdíčka, titulní fotka (R3). Vrací ID všeho
  vytvořeného (pro R7). Kontrola duplicity jména přes `neniDuplicitni`; varování, když číslo už centerfold má
  („přidat druhý“ jen vědomě).

  ```
  ┌ Přidat číslo ─────────────────────────────── 07/1977 US ▾ ┐
  │ Centerfold  [Sondra Theodore_______] nová modelka         │
  │             fotograf [Arny Freytag___]  odkazy [vložit…]  │
  │ Cover       odkazy [vložit…]   na obálce [= centerfold ▾] │
  │ Pictorial   [Pictorial 1977-07] odkazy [vložit…]  + další │
  │ Srdíčka     ♡♡♡♡♡  (1–5)        Údaje [vložit datový list]│
  │            Zrušit   Uložit a otevřít   Uložit a další číslo│
  └───────────────────────────────────────────────────────────┘
  ```
  Prázdné části se přeskočí (číslo bez coveru jde uložit). „Uložit a další číslo“ posune na další měsíc (R4)
  a vyprázdní pole kromě fotografa. Otevírá se z tlačítka +, z nabídky prázdného čísla v kalendáři a ze stránky
  čísla (předvyplněné). Výběr z Disku (1.1–1.2) se do polí odkazů napojí v 1.2 kroku 1.
- **Prac.:** M–L (okno M, Go s transakcí a testy M). **Schéma/export:** ne. **Rizika:** dlouhé ověřování
  souborů u velkých alb – ukazovat postup; částečný výsledek nesmí vzniknout (proto transakce); stará okna
  zůstávají jako druhá cesta.

### R7 – Vrátit přidání

- **Co to dá:** po uložení průvodce (a okna alba) oznámení „Přidáno 07/1977: Sondra Theodore, 3 alba, 41 fotek
  · **Vrátit**“. Překlep v čísle nebo jménu se opraví jedním klikem místo mazání alb po jednom.
- **Jak:** `ZrusitPridani(VysledekCisla)` v `pridani.go`: smaže přesně vytvořené fotky, alba, cover a modelku
  (jen pokud vznikla teď a nic dalšího nemá), před tím záloha `pred-vracenim`; tlačítko ve stávajícím
  `oznamit(text, { text: 'Vrátit', … })`.
- **Prac.:** S–M. **Schéma/export:** ne. **Rizika:** **hraniční s oddílem Nedělat** („obecné Zpět pro všechny
  úpravy“) – jde o cílené Vrátit jedné akce bez deníku, stejně jako dnešní Vrátit u fotek; potvrdit uživatelem.

### R8 – Fronta čísel ze seznamu

- **Co to dá:** uživatel vloží seznam playmate roku (z Wikipedie nebo vlastních poznámek) a průvodce pak jde
  číslo po čísle s předvyplněným měsícem a jménem. Nemusí přepínat mezi seznamem a programem kvůli jménům a
  nespletou se měsíce.
- **Jak:** v průvodci „Vložit seznam…“: řádky `1977-07 Sondra Theodore`, `July – Sondra Theodore`,
  `07/1977; Sondra Theodore` (anglické i české měsíce, tabulátor z tabulky Wikipedie). Náhled: měsíc, jméno,
  „ve sbírce / nová / číslo už má centerfold“. Fronta v tabulce `nastaveni` (klíč `fronta_cisel`), přežije
  restart; čip „Fronta: 5 zbývá“ v průvodci. Nic se nezakládá, dokud se číslo neuloží.
- **Prac.:** S–M. **Schéma/export:** ne. **Rizika:** rozpoznání řádků – nerozpoznaný řádek se ukáže
  a nepoužije.

### R9 – Údaje vložením datového listu

- **Co to dá:** text z datového listu, Wikipedie nebo databáze playmate vložený do jednoho pole vyplní najednou
  datum a místo narození, výšku, váhu, míry, vlasy a oči. Krok 8: ~60 znaků a ~25 Tabů → 1 vložení + kontrola.
  Uživatel text vkládá sám, program nic nestahuje.
- **Jak:** `rozlozitUdaje(text)` v `lib/format.js` (vedle `prevestVysku`, `prevestVahu`, `rozlozitMiry`):
  vzory `Bust/Waist/Hips`, `Height: 5'7"`, `Weight: 115`, `Born/Birth Date: May 12, 1955`, `Birthplace`,
  `Hair`, `Eyes`, `36-24-35`, české ekvivalenty; anglické barvy na hodnoty sbírky (`Blonde` → Blond).
  V průvodci a ve formuláři modelky pole „Vložit údaje…“: rozpoznané hodnoty jako štítky, prázdná pole se
  vyplní, odlišná se jen označí ⚠ a přepíší se až klikem. Testy v `frontend/test/lib.test.js` (20 skutečných
  ukázek).
- **Prac.:** M. **Schéma/export:** ne. **Rizika:** chybné rozpoznání – proto náhled a žádné tiché
  přepsání; Kontrola v Údržbě dál hlídá nesmysly. Nekoliduje s Wikidaty (1.10): ty údaje hledají, tohle jen
  čte vložený text.

### R10 – Převzít z předchozí

- **Co to dá:** v 70. letech má většina modelek stejné hodnoty ochlupení, tetování, piercingu, typu prsou
  a národnosti. Tlačítko „Jako předchozí“ (`Alt+P`) vyplní tato pole z naposledy uložené modelky. ~8 výběrů →
  1 akce.
- **Jak:** `formular-modelky.js` a průvodce: poslední uložená modelka v `stav`; vyplní jen prázdná pole
  a pole zvýrazní (pruh „převzato“), dokud se nezmění. Nikdy samo, jen na tlačítko.
- **Prac.:** S. **Schéma/export:** ne. **Rizika:** převzetí nepravdivých údajů – zvýraznění a Kontrola; pole
  „Neuvedeno“ zůstává výchozí.

### R11 – Hodnocení postupně

- **Co to dá:** modelky bez srdíček (filtr Hodnocení v Údržbě) jde ohodnotit v řadě: velká titulní fotka
  a centerfold, klávesa 1–5 uloží a ukáže další, `←` vrátí předchozí. Dnes: otevřít profil, kliknout, zpět
  (3 akce na modelku) → 1 klávesa.
- **Jak:** překryv nad Přehledem (`prehled.js`, filtr `hodnoceni`), seznam z `stav.prehledRadky`; ukládá
  `SetHodnoceni`; „Otevřít profil“ a Esc. Stejný překryv jde spustit z výběru karet v galerii.
- **Prac.:** S–M. **Schéma/export:** ne. **Rizika:** žádná; navazuje na 2.3 (odhad srdíček jako návrh v překryvu).

### R12 – Import ze schránky

- **Co to dá:** YAML nebo Markdown připravený jinde (poznámky, šablona) jde vložit bez ukládání souboru.
- **Jak:** ⋯ → „Importovat ze schránky…“: okno s textovým polem, `ImportovatText(text)` v `export.go` nad
  stávajícím `nacistDokument` a `importovatCelek` (záloha před importem jako dnes).
- **Prac.:** S. **Schéma/export:** ne (stejný formát verze 7). **Rizika:** žádná nová.

### R13 – Záloha i během dne

- **Co to dá:** práce dne je zálohovaná ještě týž den.
- **Jak:** v Go (`app.go`): záloha `pri-zavreni` v `shutdown`, když se od poslední zálohy databáze změnila
  (čas změny `playboy.db-wal` / souboru proti času poslední zálohy), fronta 7 záloh; kontrola denní zálohy
  i za běhu (časovač jednou za hodinu, když se změnil den). V okně záloh název „Při zavření“
  (`NAZVY_ZALOH`, `sprava.js:352`). Záloha 2 000 modelek trvá 0,06 s, zavření se nezdrží.
- **Prac.:** S. **Schéma/export:** ne. **Rizika:** zavření při plném disku – chyba se jen zapíše, zavření
  neblokuje. **Nekoliduje** s Nedělat („zálohy na jiný disk“): zálohy zůstávají ve stejné složce.

### R14 – Aktualizace jedním příkazem

- **Co to dá:** místo dvou příkazů jeden, který nic nerozbije.
- **Jak:** `./instalovat.sh --aktualizovat`: kontrola čistého `git status`, `git pull --ff-only`, sestavení,
  instalace, výpis „0.99.3 → 1.3.0“ a nadpisů z `CHANGELOG.md` mezi verzemi. Při místních změnách nebo
  rozbíhající se větvi skončí s návodem, nic nepřepíše. README oddíl Aktualizace.
- **Prac.:** S. **Schéma/export:** ne. **Rizika:** žádná nová (přechod databáze se zálohou už program dělá
  při startu).

### R15 – Upozornění na novou verzi

- **Co to dá:** uživatel se dozví o opravě, aniž by sledoval repozitář.
- **Jak:** `instalovat.sh` předá při sestavení cestu ke klonu (`-ldflags "-X main.slozkaZdroje=$PWD"`).
  Program jednou denně na pozadí spustí `git -C <klon> fetch` (`GIT_TERMINAL_PROMPT=0`, limit 10 s), přečte
  `Verze` z `origin/HEAD:verze.go` a při novější verzi ukáže nenápadné oznámení „Je k dispozici 1.3.0 –
  `./instalovat.sh --aktualizovat`“ s „Co je nového“ z `CHANGELOG.md` té verze. Vypnutí v ⋯; bez gitu, bez
  klonu nebo bez sítě mlčí.
- **Prac.:** S–M. **Schéma/export:** ne. **Rizika:** síťový přístup programu – jen git nad vlastním
  klonem, nic se nestahuje do sbírky ani neinstaluje samo. Netýká se bodu Nedělat „stahování údajů z webu“
  (jde o program, ne o údaje), ale **potvrdit**.

### R16 – Dnešní souhrn (rozšíření 1.7)

- **Co to dá:** „Dnes: 23 modelek, 41 alb, 1 380 fotek, 23 ohodnoceno, dokončeno 1977-01 až 1977-11“ – přehled
  odvedené práce a kontrola, že žádné číslo nevypadlo (díra v řadě měsíců se ukáže).
- **Jak:** karta nad částí „Naposledy přidané“ (1.7 krok 1) z údajů `pridano`; díry = měsíce bez centerfoldu
  mezi prvním a posledním dnes přidaným číslem.
- **Prac.:** S. **Schéma/export:** ne. **Zařazení:** krok 4 verze 1.7.

### R17 – Velikost písma a přiblížení

- **Co to dá:** delší práce bez namáhání očí; rozhraní má mnoho textu 11–12 px (`style.css`).
- **Jak:** `Ctrl` + `+` / `-` / `0` a volba v ⋯ → Vzhled: přiblížení 90–150 % (`zoom` na kořenovém prvku,
  WebKitGTK ho podporuje), uložené v `nastaveni`; zkontrolovat úzké okno a mřížky.
- **Prac.:** S–M. **Schéma/export:** ne. **Rizika:** rozložení mřížek a plakátů při 150 % – projít snímky.

### R18 – Popisky pro čtečku a klávesnici

- **Co to dá:** srozumitelné ovládání bez myši a se čtečkou obrazovky.
- **Jak:** `aria-label` u křížků oken (`sablona.js:123, 143, 308, 375` a dál), srdíčka jako skupina
  s `aria-label="Hodnocení"` a `aria-pressed` (`galerie.js:27`), viditelný fokus u štítků kategorií, ověřit
  Orcou na Fedoře.
- **Prac.:** S. **Schéma/export:** ne.

### Nedoporučuji / konflikty

| Nápad | Proč ne | Vztah k plánu |
|---|---|---|
| Záloha na druhé místo (USB, synchronizovaná složka) | **Konflikt** s Nedělat „zálohy na jiný disk“. Náhradou je export YAML, který si uživatel uloží kam chce. Pokud by uživatel rozhodnutí změnil: volba „kopírovat denní zálohu i do složky…“, S | k rozhodnutí |
| Obecné Zpět | **Konflikt** s Nedělat; R7 řeší jen poslední přidání | – |
| Flatpak nebo RPM | Jeden uživatel, instalace do domovské složky funguje a je ověřená; Flatpak = sandbox, jiná cesta k datům, WebKitGTK z runtime, OAuth z 1.1 znovu ověřit (L). Položka `.desktop` s ikonou už existuje | rezerva, jen při dalším uživateli |
| Rychlejší start | 0,13 s s 2 000 modelkami | – |
| Šablony celých modelek | R10 a R9 pokryjí totéž bez nové správy šablon | – |

## 3. Drobné opravy

Nalezené při čtení; každá je PATCH v nejbližší verzi (nebo 0.90.x, pokud jde o chybu).

| # | Kde | Co | Prac. |
|---|---|---|---|
| 1 | `frontend/src/app/ulozeni.js:68` | Ochrana „Zahodit změny?“ chybí u okna článku (`clanekModal`), Doplnit modelku (`doplnitModal`) a Upravit číslo (`issueModal`): Esc (i v textovém poli) zavře rozepsaný článek bez dotazu (`nabidky.js:252`) | S |
| 2 | `frontend/src/app/doplneni.js:71` | Dvojitá trojtečka „Přidat fotky nebo album……“ | S |
| 3 | `frontend/src/app/vydani.js:125–126` | Prázdný stav čísla radí „Pictorial se k číslu přiřadí v úpravě alba modelky“, ale číslo má tlačítko „+ Pictorial“ (`vydani.js:87`) | S |
| 4 | `frontend/src/app/kalendar.js:200` | Nabídka čísla nabízí „Přidat pictorial…“ jen u čísla bez pictorialu; druhý pictorial jde přidat jen ze stránky čísla | S |
| 5 | `frontend/src/app/formular-alba.js:75` a `ulozeni.js:251` | „Uložit a přidat další“ u centerfoldu nechá typ Centerfold a kurzor v odkazech – druhý centerfold téže modelky v tomtéž čísle je skoro vždy omyl (řeší R1) | S |
| 6 | `frontend/src/app/formular-alba.js:30` | Dvě modelky stejného jména (rozlišené datem narození, viz Rozhodnuto) – okno alba potichu vybere novější; nabídnout výběr s datem narození | S |
| 7 | `app.go:2603–2618` | Fotky alba se vkládají po jedné mimo transakci; chyba uprostřed nechá půlku alba (R6 to potřebuje v transakci, stejná úprava pro `AddBulkPhotos`) | S |
| 8 | `verze.go:7` | Komentář odkazuje na „1.0.0-alpha.N“ a oddíl „Cesta k 1.0.0“, který v ROADMAP už není | S |
| 9 | `frontend/src/sablona.js:123, 143, 308, 375, 412` | Křížky oken bez `title` a `aria-label` (čtečka přečte „krát“) – součást R18 | S |
| 10 | `frontend/src/app/cover.js:31–35` | Okno coveru z tlačítka + nemá rok ani měsíc, ačkoli kalendář ví, kde uživatel je (řeší R4) | S |

## 4. Rozdělení do verzí a pořadí

Každá verze 2–4 kroky, 1–3 dny, vyzkoušitelná sama o sobě, bez změny schématu a exportu.

| Verze (návrh) | Obsah | Kroky | Závisí na | Doporučené místo |
|---|---|---|---|---|
| 1.12 | Rychlé přidávání I – centerfold a pictorial v jednom okně, na obálce u coveru, titulní fotka sama, další číslo jako výchozí | R1, R2, R3, R4 | – | **první po 1.0.0, před 1.1** |
| 1.13 | Přidat číslo – průvodce, klávesnice, Vrátit, fronta ze seznamu | R6, R5, R7, R8 | 1.12 (R4) | **hned po 1.12, před 1.1** |
| 1.14 | Údaje rychleji – datový list, jako předchozí, hodnocení postupně | R9, R10, R11 | 1.13 (pole v průvodci) | hned po 1.2 |
| 1.15 | Zálohy a aktualizace – záloha během dne, aktualizace jedním příkazem, upozornění na verzi, import ze schránky | R13, R14, R15, R12 | – | hned po 1.4 |
| 1.16 | Přístupnost – přiblížení, popisky | R17, R18 | – | po 1.9 (před Wikidaty) |
| 1.7 krok 4 | Dnešní souhrn | R16 | 1.7 krok 1 | v 1.7 |
| 1.2 krok 1 | Výběr z Disku i v průvodci Přidat číslo | – | 1.13 | v 1.2 |

**Proč 1.12 a 1.13 před Google Diskem:** uživatel teď přidává desítky modelek denně a každé číslo stojí ~24
akcí; 1.12 je čtyřikrát S bez rizika, 1.13 sníží práci na třetinu. 1.1 začíná prototypem s nejistým výsledkem
(Picker, `drive.file`) a vyžaduje založení projektu v Google Cloud. Výběr z Disku pak průvodce jen doplní
(1.2 krok 1) – nic se nedělá dvakrát, protože průvodce ukládá stejné odkazy jako dnešní okna.

**Doporučené celkové pořadí řady 1.x:** 1.12 → 1.13 → 1.1 → 1.2 → 1.14 → 1.3 → 1.4 → 1.15 → 1.5 → 1.6 → 1.7
(s R16) → 1.8 → 1.9 → 1.16 → 1.10 → 1.11. Drobné opravy 1–8 jako PATCH hned (1 je skoro chyba – ztráta
rozepsaného článku; hodí se do bety jako 0.90.x/0.99.x, pokud ji uživatel zapíše do „Chyby z bety“).

Pokud se ROADMAP při vložení přečísluje podle priority, nové verze dostanou čísla podle místa a sloupec „Dřív“
uvede „návrh 1.12“ atd. (odkazy v tomto souboru používají předběžná čísla).

**Odhad po zavedení (scénář z oddílu 1):**

| Stav | Akce | Psaní | Okna |
|---|---|---|---|
| Dnes | ~24 + ~25× Tab | ~130 znaků | 6 |
| Po 1.12 | ~15 + ~25× Tab | ~95 znaků | 5 |
| Po 1.13 | ~8 + údaje (~2 + ~25× Tab) | ~87 znaků | 2 |
| Po 1.14 | ~10 | ~27 znaků | 1 |

## 5. Vztah k Rozhodnuto a Nedělat

- **Nedělat – obecné Zpět:** R7 je cílené Vrátit jedné akce (jako Vrátit u fotek), bez deníku změn. Hraniční,
  potvrdit.
- **Nedělat – zálohy na jiný disk:** R13 zůstává ve složce záloh, bez konfliktu; záloha na druhé místo je
  v oddílu „Nedoporučuji“ jako konflikt.
- **Nedělat – stahování údajů z webu:** R9 čte jen text, který uživatel sám vloží; R15 stahuje jen novou verzi
  programu do vlastního klonu přes git a nic neinstaluje. Potvrdit u R15.
- **Nedělat – automatický import celé složky:** R8 nezakládá nic bez uložení čísla; fotky dál jen z vložených
  odkazů nebo z výběru (1.1).
- **Rozhodnuto – dvě modelky stejného jména:** průvodce i oprava 6 nabízí výběr podle data narození.
- **Rozhodnuto – výtisky jen u CZ:** průvodce u edice CZ nabídne „Mám výtisk / Sháním“, u US ne.
- **Rozhodnuto – Google Disk jen k výběru:** průvodce dál ukládá ID souborů jako dnešní okna.

## 6. K vložení do ROADMAP

Řádky do tabulky verzí (pod 1.11, nebo podle zvoleného pořadí):

```markdown
| 1.12 | Rychlé přidávání I – centerfold a pictorial v jednom okně, na obálce u coveru, titulní fotka sama, další číslo jako výchozí | – | návrh 1.12 |
| 1.13 | Přidat číslo – průvodce pro celé číslo, klávesnice, Vrátit přidání, fronta ze seznamu | 1.12 | návrh 1.13 |
| 1.14 | Údaje rychleji – vložení datového listu, jako předchozí, hodnocení postupně | 1.13 | návrh 1.14 |
| 1.15 | Zálohy a aktualizace – záloha během dne, aktualizace jedním příkazem, upozornění na novou verzi, import ze schránky | – | návrh 1.15 |
| 1.16 | Přístupnost – přiblížení, popisky pro čtečku | – | návrh 1.16 |
```

Oddíly verzí:

```markdown
### 1.12 – Rychlé přidávání I

**Cíl:** přidání čísla (centerfold, cover, pictorial) s méně okny a bez opakovaného psaní jména, fotografa
a vydání. Uživatel přidává desítky modelek denně chronologicky, proto jde před Google Disk (1.1). **Bez změny
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

### 1.13 – Přidat číslo

**Cíl:** celé číslo v jednom okně a jen klávesnicí; přidání jedné playmate z ~24 akcí na ~8. **Bez změny
schématu i exportu.** Závisí na 1.12 (další číslo).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Průvodce „Přidat číslo“ | Okno `pridat-cislo.js`: vydání, centerfold (jméno, fotograf, odkazy), cover (odkazy, na obálce), pictorialy, srdíčka; `PridatCislo` v `pridani.go` – ověření souborů předem, uložení v jedné transakci, kontrola duplicity jména a druhého centerfoldu; „Uložit a další číslo“ | M–L |
| 2 | Klávesnice | `Ctrl+N` Nová modelka, `Ctrl+Shift+N` Přidat číslo, `Ctrl+Enter` uloží okno, „Přidat a další“ v okně Nová modelka, 1–5 a 0 hodnotí modelku v profilu; přehled zkratek | S |
| 3 | Vrátit přidání | Oznámení „Přidáno 07/1977: …“ s Vrátit: smaže přesně vytvořené (modelku jen novou a bez dalších alb), záloha před vrácením; cílené Vrátit, ne deník změn | S–M |
| 4 | Fronta ze seznamu | „Vložit seznam…“ v průvodci (`1977-07 Jméno`, `July – Jméno`, tabulka z Wikipedie), náhled, fronta v `nastaveni`; průvodce jde číslo po čísle s předvyplněným měsícem a jménem | S–M |

**Hotovo, když:** číslo s centerfoldem, coverem a pictorialem jde přidat jedním oknem bez myši; chyba
uprostřed neuloží nic; Vrátit vrátí sbírku do stavu před uložením; seznam dvanácti playmate roku projde
frontou bez psaní jmen.

### 1.14 – Údaje rychleji

**Cíl:** údaje a srdíčka nové modelky bez přepisování pole po poli. Uživatel text vkládá sám, program nic
nestahuje. **Bez změny schématu i exportu.**

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Vložení datového listu | `rozlozitUdaje` v `lib/format.js` (narození, místo, výška, váha, míry, vlasy, oči; anglicky i česky); ve formuláři a v průvodci pole „Vložit údaje…“: štítky rozpoznaných hodnot, prázdná pole se vyplní, odlišná jen ⚠; testy na 20 skutečných ukázkách | M |
| 2 | Jako předchozí | Tlačítko a `Alt+P`: ochlupení, tetování, piercing, typ prsou a národnost z naposledy uložené modelky, jen do prázdných polí a zvýrazněné | S |
| 3 | Hodnocení postupně | Překryv nad filtrem Hodnocení v Údržbě (i z výběru karet): velká fotka, 1–5 uloží a ukáže další, ← předchozí, Esc | S–M |

**Hotovo, když:** datový list vložený do formuláře vyplní všechna rozpoznaná pole a nic nepřepíše bez
potvrzení; dvacet modelek bez srdíček jde ohodnotit dvaceti klávesami.

### 1.15 – Zálohy a aktualizace

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

### 1.16 – Přístupnost

**Cíl:** pohodlné čtení a ovládání bez myši a se čtečkou obrazovky. **Bez změny schématu i exportu.**

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Přiblížení | `Ctrl` + `+` / `-` / `0` a ⋯ → Vzhled: 90–150 %, uložené v `nastaveni`; snímky všech pohledů při 150 % a v úzkém okně | S–M |
| 2 | Popisky | `aria-label` u křížků oken, srdíčka jako skupina s `aria-pressed`, viditelný fokus u štítků; ověření Orcou na Fedoře | S |

**Hotovo, když:** při 150 % žádný pohled nepřetéká; Orca přečte okna, srdíčka i tlačítka srozumitelně česky.
```

Doplnění existujících verzí:

```markdown
<!-- 1.7 – nový řádek tabulky kroků -->
| 4 | Dnešní souhrn | Karta nad „Naposledy přidané“: dnes přidané modelky, alba, fotky a hodnocení, rozsah dokončených čísel a díry v řadě měsíců | S |

<!-- 1.2, krok 1 – doplnit do sloupce Jak -->
… a pole odkazů v průvodci Přidat číslo (1.13)
```

Návrh do oddílu Rozhodnuto (po schválení):

```markdown
- Přidávání čísel (1.12–1.13): průvodce Přidat číslo ukládá vše v jedné transakci; Vrátit přidání je cílené
  Vrátit jedné akce (jako u fotek), ne obecné Zpět s deníkem změn.
- Údaje z vloženého textu (1.14): program čte jen text, který uživatel sám vloží; nic nestahuje a odlišné
  hodnoty nepřepíše bez potvrzení.
```
