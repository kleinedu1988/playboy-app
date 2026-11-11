# K vyzkoušení

Co jde ověřit jen v opravdovém programu (testy a sestavení prošly, ale okno, tisk ani síť se automaticky nezkouší).
Hotové body odškrtni `[x]`; co nefunguje, napiš pod bod. Nové verze se přidávají nahoru nad kontrolní seznam.

Před zkoušením nainstaluj aktuální verzi: `./instalovat.sh` ve složce programu.

## 0.02.047 – Výkon vykreslování

- [ ] Galerie: druhé a další otevření řad kolekcí je znatelně rychlejší; po hodnocení fotky (a chvíli klidu) také.
- [ ] Otevření profilu na skutečném počítači: ⋯ › Nápověda › Přehled výkonu – `GetKalendar` jen jednou na profil.
- [ ] Na skutečném počítači porovnat plynulost profilu a Galerie (snímkovač kreslí softwarově, časy kreslení z něj
  nejsou spolehlivé).

## 0.02.046 – Stejná data ve všech pohledech

- [ ] Hledání `casopis:ph` najde i modelku, která má Penthouse jen v textovém vydání pictorialu (profil ukazuje
  „Penthouse 1992“); počet výsledků `casopis:pb` / `casopis:ph` sedí s volbou časopisu v Síni slávy.

## 0.02.045 – Údržba a Statistiky

- [ ] Údržba › Po modelkách: modelka jen s Pet of the Month bez data narození má důvod „Pet bez data narození…“.
- [ ] Modelka s „Playmate“ jen v poli Role (bez centerfoldu a pictorialu) už nemá vyšší prioritu úkolů.
- [ ] Návrh druhu alba u pictorialu „Pet of the Month …“ píše Pet of the Month.

## 0.02.044 – Hodnocení a Síň slávy

- [ ] Síň slávy › Penthouse: hero „nejvýš v pořadí“ s Ilse Hasek a velkou fotkou; zpět Všechny časopisy → jednička.
- [ ] Síň slávy: karty pod herem (Legendy, Odznaky, Rekordy) přepnou pohled; v Kronice filtry (Jedničky, Obhajoby…).
- [ ] Porovnat: velké fotky v pásu přes celou výšku karty, srdíčka nad názvem alba.
- [ ] Pás fotek na stránce čísla zůstal malý (120 px) jako dřív.

## 0.02.043 – Stránky Čísel

- [ ] Kalendář › Penthouse US: hero „Ročník 1969 … – Pet of the Month Ulla Lindstrom“ s její fotkou.
- [ ] Obálky › Playboy US: u čísla s prázdným centerfoldem (Leden 1975) jméno „Playmate měsíce Lynnda Kimball“.
- [ ] Číslo Listopad 1969 · Penthouse: v obsahu a u alba „Pet of the Month“.
- [ ] Centerfoldy › Penthouse: „Penthouse: zatím žádný centerfold“.
- [ ] Mapa čísel jsem na snímcích neprošel (nepodařilo se do ní dostat skriptem) – projdi obě řady.

## 0.02.042 – Karty modelek

- [ ] V Galerii zapni „rok na kartě“: Ulla Lindstrom „1969 PH“ (zkratka v barvě Penthouse), Ali Rose „2014“.
- [ ] Řazení Podle roku: Heide Mann a Ilse Hasek v 70. letech, ne v „Bez vydání“.
- [ ] Hledání `casopis:` – nadpis nabídky „Možnosti filtru Časopis“.

## 0.02.041 – Profil

Profily pěti vzorových modelek jsem prošel na snímcích (1280 a 1920 px); v opravdovém okně zbývá:
- [ ] Jenna Sativa v užším okně: nadtitulek na dva řádky, druhý řádek začíná „Modelka“, ne „·“.
- [ ] Allison Parks › album Playmate of the Month October 1965: „Natural Wonder“ jako malý nadpis nad textem.
- [ ] Panel Údaje se vysouvá asi sekundu – nepřipadá ti pomalý?

## 0.02.040 – Proč chybí odhad srdíček

- [ ] **Kritérium hotovo:** Hodnocení – pod větou o modelu vkusu „Odhad srdíček má … nehodnocených modelek ·
      čeká na galerii: … · čeká na analýzu fotek: …“ (na kopii sbírky 179 / 63 / 2).
- [ ] Profil nehodnocené modelky bez fotek (např. Abella Danger): štítek „bez odhadu · čeká na galerii“, nápověda
      po najetí; nevypadá jako srdíčka ani jako odhad.
- [ ] Jackie Rainbow nebo Jayne Mansfield: „čeká na analýzu fotek“; po doběhnutí analýzy (Údržba › Na pozadí)
      štítek zmizí a objeví se odhad.
- [ ] Po prvním spuštění se štítek může ukázat až po přepočtu oblíbenosti (uložená oblíbenost z minulého běhu ho nemá).

## 0.02.039 – Data do pořádku v Údržbě

- [ ] **Kritérium hotovo:** Údržba › návrhy: Heide Mann · „Pet of the Month October 1970“ – číslo „Říjen 1970 ·
      Penthouse“ (99 %). Přijmout → profil ukazuje číslo i po restartu (v databázi `1970-10@PH`).
- [ ] Hromadně přijmout víc návrhů (např. všechny typy alb, na kopii sbírky jich je 490): okno rozdílu ukazuje
      u typu „Pictorial → Pictorial modelky měsíce…“, po přijetí Vrátit v oznámení vše vrátí.
- [ ] Jenna Sativa: návrhy „2016-04 · Penthouse“ a typ „… of the Year“ u „Penthouse Pet of the Year 2017“.
- [ ] Dolly Read, Mary Collinson, Haley Cummings, Sandra Edwards: návrh typu alba z titulu v Roli (75 %).
- [ ] Stefanie Knight: album „2017-PMOY-MX“ nedostane číslo 2016-06-MX.

## 0.02.038 – Tituly všude z galerií

- [ ] **Kritérium hotovo:** Galerie › filtr Kategorie a hledání `kategorie:"playmate mesice"` ukážou stejné modelky
      jako štítky v profilu; modelka s „PMOTM“ jen v Roli (bez alba) tam není.
- [ ] Allison Parks (prázdné album Centerfold): profil „Playboy 1965 · Playmate měsíce · Playmate roku 1966“.
- [ ] Statistiky › Rozložení › Kategorie: počty Playmate měsíce a roku odpovídají; přibyla „Online“, zmizely Coed,
      Muse a „Playboy …“ zapsané jen v Roli.
- [ ] Galerie › kolekce „Playmate roku“ ukazuje modelky s albem Playmate roku (ne podle Role).
- [ ] Playboy Bunny zůstává v profilu jako profese.

## Kontrolní seznam po obrazovkách (0.02.037, 11. 11. 2026)

Shrnutí 213 neověřených bodů z verzí 1.45–0.02.036 do 40 bodů. Číslo v závorce vede na podrobnosti
v [docs/archiv/K-VYZKOUSENI-DO-0.02.036.md](docs/archiv/K-VYZKOUSENI-DO-0.02.036.md). Vzorové modelky: Buffy Tyler
(Playboy), Ulla Lindstrom, Heide Mann a Ilse Hasek (Penthouse), Ali Rose (Playboy ZA a online), Jenna Sativa
(Penthouse a online).

### Profil

- [ ] **Štítky a nadtitulek** vzorových modelek mají strukturu časopis → role → profese a štítky jsou na pohled
      odlišené: plný, obrys, tlumený (0.02.034, 0.02.036). *Data jsem ověřil, vzhled ne.*
- [ ] **Pásky čísel a blok Časopisy:** modelka z Playboye i Penthouse ukáže obě čísla s titulem („Pet · Zář 85 · PH“).
      Barva časopisu je na tmavém záhlaví vidět a bublina čísla má „Pet“ (0.02.010, 0.02.026).
- [ ] **Přezdívky:** „Jane Doe @PH“ v Dalších jménech → „také Jane Doe (Penthouse)“. Zápis „jane doe@ph“ se sjednotí.
      Najde se hledáním i našeptávačem a `[[Jane Doe]]` odkáže na modelku (0.02.027, 0.02.028).
- [ ] **Sloučení:** ⋯ › Sloučit s jinou modelkou → čitelný rozdíl nanečisto → Vrátit vrátí obě modelky i s porovnáními.
      Po přidání fotky Vrátit odmítne (0.02.033).
- [ ] **Odhad srdíček:** nová modelka bez fotek nemá „odhad“. Po galerii a analýze obsahu se objeví a důvod uvádí
      „podobně jako …“ (0.02.031).
- [ ] **Upravit → Uložit** u Ully Lindstrom zapíše do databáze `1969-11@PH` (0.02.032).

### Galerie a hledání

- [ ] **Časopis v hledání:** `casopis:penthouse 80. léta`, `-casopis:penthouse`, čip po napsání `ph` / `hustler`,
      našeptávač `casopis:`. Uložený výběr s časopisem vydrží restart (0.02.019).
- [ ] **Kategorie:** `kategorie:"pet of the month"` najde Pet, ne Playmate. Filtr Kategorie nabízí Pet of the Month
      s počtem, `pmom` jako dřív (0.02.012).
- [ ] **Hledání 2:** `foto:"bazén" výška > 175` (kolik nalezených je omylem?). Dál `blond nebo zrzka` a závorky,
      věta „Hledám: …“, historie dotazů, Ctrl+S uloží výběr ⚡ a „+1“ u výběru (1.52.0).
- [ ] **Karty modelek:** velikosti Malé/Střední/Velké, vypnutí srdíček, rok a počet fotek u jména. Na malých kartách
      je jméno čitelné (1.49.0).

### Čísla

- [ ] **Kalendář podle časopisu:** volba Penthouse US, chybějící měsíce s +, „Penthouse UK: zatím žádné číslo“.
      Volba se pamatuje. Ročník Penthouse 1969 má leden až srpen „nevyšlo“. Sedí řady na tvých výtiscích? (0.02.015, 0.02.016)
- [ ] **Hero Kalendáře:** obálka celá i s názvem časopisu, výročí v listopadu. Fungují tlačítka (Otevřít, Ukázat
      v kalendáři, Doplnit chybějící, Další ročník ↻). Při hledání hero zmizí (0.02.023).
- [ ] **Obálky a jejich hero:** přepnutí na Penthouse ukáže jen jeho obálky, „Na obálce …“ / „Centerfold …“.
      Počet chybějících sedí (0.02.016, 0.02.024).
- [ ] **Stěna Centerfoldů:** volby Playboy, Penthouse, Penthouse UK, Všechny časopisy a Hustler. Hero v rámu 3 : 4 není
      moc oříznutý a Další ↻ střídá jen zvolený časopis (0.02.018, 0.02.025).
- [ ] **Mapa čísel:** karta „Penthouse US · archiv dat“, úplnost zvlášť. Ve Vzhledu jde kartu skrýt a posunout (0.02.017).
- [ ] **Stránka čísla Penthouse:** drobeček ročníku, Jako časopis bez „Playboy ·“, Upravit číslo. Odkaz `[[09/1985@PH]]`
      v textu ukáže „Září 1985 · Penthouse“ (0.02.002–0.02.010, 0.02.022).
- [ ] **Pohledy Playboye bez Penthouse:** Kalendář, Obálky, Mapa čísel, Kapesní katalog a stěna „Playboy“ neukazují
      Penthouse. Číslo 09/1985 Playboye listuje na 08 a 10/1985 Playboye (0.02.007).

### Okno alba a rychlé přidání

- [ ] **Okno alba s časopisem:** Penthouse US nabídne Pet of the Month / Year, zvolený druh zůstane i po přepnutí
      časopisu. Album, cover i speciál Penthouse se uloží. Řádek měsíc · rok · časopis se vejde i v úzkém okně (0.02.005, 0.02.011).
- [ ] **Rychlé přidání** (Ctrl+Shift+N) s volbou časopisu: nová modelka s Penthouse US 10/1985 dostane centerfold
      „Říjen 1985 · Penthouse“ (0.02.006).

### Hodnocení a Síň slávy

- [ ] **Síň slávy s volbou časopisu:** Top 10 jen Penthouse s celkovým místem, hláška, když tam nikdo není, sezóna.
      **Co ukáže trůn?** Volba se pamatuje (0.02.021).
- [ ] **Rok ve sbírce:** čísla odpovídají, Tisk / PDF bez uříznutí, Jako časopis. Celý ročník Penthouse se ohlásí
      (1.46.0, 0.02.021).

### Údržba

- [ ] **Kandidáti na sloučení:** tlačítko „Sloučit“, důvody z fotek. Je práh 85 % pro „podobné fotky“ rozumný?
      Filtr zdroje a „V pořádku“ (0.02.029, 0.02.030, 0.02.033).
- [ ] **Texty Pet:** „Pet bez data narození…“, „Číslo nemá Pet – přidej jí centerfold“ (0.02.022).
- [ ] **Režim Dnes a panel Na pozadí:** pokrok dne a série, klik na nejcennější, Spustit / Pozastavit úloh na pozadí
      (1.51.0).
- [ ] **Hromadně s rozdílem nanečisto:** Přijmout zobrazené, Otočit zobrazené, Vyměnit za lepší, Sloučit jistě stejné.
      Rozdíl odpovídá a Vrátit vrátí vše (1.51.1).
- [ ] **Prahy podle vzorku:** z Kvality fotek a Otočených fotek projdi aspoň 50 fotek a spočítej, kolik je hlášeno
      omylem (1.45.0, 1.51.0).

### Statistiky

- [ ] **Pet není Playmate:** Rozložení › Kategorie ukáže Pet of the Month. Texty říkají „v Playboyi“. Mapa sbírky
      má barvu „Titul jiného časopisu“. Vkus říká „byla Pet of the Month“ (0.02.020, 0.02.022).
- [ ] **Mapa sbírky:** plynulá, autoenkodér doběhne, Přepočítat od začátku. **Můj vkus v čase** a karta **Objevit**
      dávají smysl. PNG / CSV / Tisk grafu (1.53.0).

### Správa, export a verze

- [ ] **Časopisy…:** nový časopis Oui s edicemi US, FR. Úprava barvy a titulu, mazání jen bez čísel, Playboy bez
      Smazat. V úzkém okně nic nepřetéká (0.02.013).
- [ ] **Export a import:** export má `verze: 14`, `casopisy` a `1985-09@PH`. Načte se do čisté sbírky, starý export
      verze 13 také. Název souboru `pinup-katalog-…yaml` (0.02.008, 0.01.001).
- [ ] **Obnovení zálohy** starší než 0.02.003 funguje a databáze se znovu upraví (0.02.003).
- [ ] **Nová verze:** Zkontrolovat novou verzi, bez internetu chyba do 15 s, volba „každý den“ vydrží restart
      (1.48.0, 0.01.001).
- [ ] **Kapesní katalog v telefonu:** počty, otevření bez připojení, hledání a filtry, světlý i tmavý režim (1.47.0).
- [ ] **Po přejmenování:** nastavení okna, historie hledání a zapamatovaná sekce přežily. „Co je nového“ jen jednou.
      Alt+Tab a panel ukazují Pinup Katalog (0.01.001).

### Vzhled a ovládání

- [ ] **Přiblížení 150 %:** projdi hlavní obrazovky a okna. Bubliny a nabídky sedí na místě, tažení funguje.
      Ctrl + numerické +/−/0, Ctrl+1…9 nepřibližuje (1.49.0).
- [ ] **Hustota a pohyb:** Kompaktní má v Údržbě aspoň o 30 % víc řádků. Pohyb Žádné/Omezené nic nezasekne.
      Výchozí vrátí vše (1.49.0, 1.50.0).
- [ ] **Prohlížeč fotek:** rozmazané pozadí, ovládání Trvale, filmový pás. Po startu otevřít správnou sekci.
      Záhlaví profilu Jen pruh / Vysoké (1.50.0).
- [ ] **PDF čísla:** 200stránkové číslo do 5 s, listování a dvoustrany, náhledy, lupa i Ctrl + kolečko.
      Ve WebKitGTK se pdf.js načte (0.02.035).
- [ ] **Text k odsouhlasení:** souhlasíš, že výskyty v `docs/VYSKYTY-PLAYMATE.md` jsou opravdu Playboy? (0.02.022)

### Ověřeno při sestavení seznamu (11. 11. 2026, kopie tvé sbírky, originál beze změny)

- [x] Po přejmenování: `~/.local/share/playboy-app` ani `~/.cache/playboy-app` neexistují, data a mezipaměť jsou
      v `pinup-katalog`, v nabídce aplikací je `pinup-katalog.desktop` (0.01.001).
- [x] Tabulka časopisů má Playboy (US, CZ), Penthouse (US, UK) a Hustler (US). Zálohy „pred-migraci“ existují (0.02.003).
- [x] Na celé sbírce (613 modelek) není žádný kandidát na sloučení se stejným jménem a jiným datem narození (0.02.029).
- [x] Štítky profilu z dat sbírky: Buffy Tyler „Playboy 2000 · Playmate měsíce · Modelka“, Ulla Lindstrom „Penthouse
      1969 · Pet of the Month · Modelka · Herečka · Tanečnice“, Heide Mann a Ilse Hasek „Penthouse 1970 · Pet of the
      Month · Modelka“ (0.02.034, 0.02.036).
- [x] Model vkusu platí (přesnost 0,63) a odhad má 125 nehodnocených modelek (0.02.031).
- [x] Body jen o tom, že „Playboy vypadá jako dřív“, ověřují testy: názvy čísel, Kalendář US a CZ, speciály,
      `edice:cz` (0.02.001, 0.02.002, 0.02.004, 0.02.009, 0.02.014).
- [x] Přepsané pozdějšími verzemi, nezkouší se: nadtitulek a blok „Playboy“ z 0.02.026 (od 0.02.034 jednotné).
      Známé omezení 0.02.011 vyřešila verze 0.02.012.

### Zjištěno při ověření (opraví se v etapě Ladění)

- [x] ~~Jenna Sativa: online alba jako Playboy~~ – omyl: její online alba jsou opravdu Playboy (Cybergirl 2015).
      Pet of the Month 2016 a Pet of the Year 2017 má jako Pictorial bez čísla (prázdné) → 0.02.039.
- [ ] **Ali Rose:** „PMOTM (ZA)“ je jen v Roli, album s typem Playmate měsíce chybí. Proto má jen „Pictorial“ → 0.02.039.
- [ ] **41 modelek má titul jen v Roli** (16 Playmate roku, 10 Pet, 8 Cyber Girl, 6 Playmate měsíce, 1 Honey), např.
      Claudia Jennings, Angela White, Amber Sym. Od 0.02.039 návrh typu alba pomůže tam, kde má jediný pictorial
      nebo titul v názvu alba; ostatním chybí album s titulem (nahrát ho). U Allison Parks je v Roli překlep „Herčka“.
- [x] ~~56 nehodnocených modelek s fotkami nemá odhad~~ – omyl kopie bez analýzy obsahu; doopravdy čekají na analýzu
      jen 2 (0.02.040).
- [ ] **Pseudonym „Hope Levin“** mají Hope Marie Carlton i Cherie Witter (nález „stejné jméno“ v Údržbě) – ověř, ke které
      patří.
- [ ] **Výkonové testy** Mapy sbírky a Kendallova τ občas trvají přes limit → 0.02.047.
