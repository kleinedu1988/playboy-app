# K vyzkoušení

Co jde ověřit jen v opravdovém programu (testy a sestavení prošly, ale okno, tisk ani síť se automaticky nezkouší).
Hotové body odškrtni `[x]`; co nefunguje, napiš pod bod. Nové verze se přidávají nahoru.

Před zkoušením nainstaluj aktuální verzi: `./instalovat.sh` ve složce programu.

## 0.02.021 – Síň slávy a Rok ve sbírce přes časopisy

- [ ] **Kritérium hotovo:** Síň slávy › volba „Penthouse“ v liště: Top 10 jen s modelkami Penthouse (s celkovým
      místem), Legendy, Odznaky, Rekordy a Kronika také.
- [ ] Žádná modelka Penthouse v Top 10 → hláška „Z časopisu Penthouse teď nikdo v Top 10 není“.
- [ ] Hero (trůn) při volbě časopisu: co ukáže, když jednička celé sbírky z časopisu není? (možná k doladění)
- [ ] Sezóna: pořadí jen modelek zvoleného časopisu; vyhlášení sezóny se volbou nemění.
- [ ] Volba se pamatuje po restartu; se sbírkou jen z Playboye se neukáže.
- [ ] Rok ve sbírce: celý ročník Penthouse dokončený letos → „Ročník 1985 Penthouse US je celý“.

## 0.02.020 – Statistiky a Postřehy podle časopisu

- [ ] **Kritérium hotovo:** se sbírkou s Penthouse nikde ve Statistikách „Playmate“ u modelky jen z Penthouse
      (Rozložení Kategorie ukáže „Pet of the Month“).
- [ ] Graf v čase (Výška) – nápověda a Postřeh říkají „rok prvního výskytu v Playboyi“; bez jiného časopisu
      „v časopise“ jako dřív.
- [ ] Mapa sbírky › barva Kategorie: Pet of the Month oranžově s položkou „Titul jiného časopisu“ v legendě.

## 0.02.019 – Hledání podle časopisu

- [ ] **Kritérium hotovo:** v Modelkách `casopis:penthouse 80. léta` najde modelky s číslem Penthouse z 80. let.
- [ ] `ph` a `hustler` v poli hledání ukážou čip „Časopis: Penthouse / Hustler“; `playboy` hledá text jako dřív.
- [ ] `-casopis:penthouse` vynechá modelky s číslem Penthouse; modelka z Playboye i Penthouse se najde pod oběma.
- [ ] Na stěně Centerfoldů (Všechny časopisy), v Kalendáři a Obálkách filtruje `casopis:ph`.
- [ ] Našeptávač: po `cas` nabídne `casopis:`, po `casopis:` časopisy s počtem modelek.
- [ ] Chytrý výběr uložený s `casopis:penthouse` funguje po restartu.

## 0.02.018 – Stěna Centerfoldů podle časopisu

- [ ] **Kritérium hotovo:** Modelky › Centerfoldy › „Časopis: Penthouse“: jen centerfoldy Penthouse (Pet of the
      Month); „Penthouse UK“ jen britské.
- [ ] Výchozí „Playboy“ ukazuje totéž co dřív „vše“; Playboy US a CZ jako dřív US a CZ.
- [ ] „Všechny časopisy“: Playboy i Penthouse dohromady, řazení podle čísla funguje.
- [ ] Hustler (jedna edice) má v nabídce jen jednu položku „Hustler“.

## 0.02.017 – Mapa čísel pro každý časopis

- [ ] **Kritérium hotovo:** Sbírka › Mapa čísel: pod americkou edicí karta „Penthouse US · archiv dat“ 1969–2018;
      09/1985 kompletní nebo částečné podle obsahu, klik otevře číslo, prázdné políčko nabídne přidání.
- [ ] Česká a americká edice Playboye vypadají jako dřív; úplnost Penthouse a Playboye se počítá zvlášť.
- [ ] Penthouse UK a Hustler bez čísel ve sbírce kartu nemají.
- [ ] ⋯ › Vzhled › Karty Mapy čísel: Penthouse US, Penthouse UK, Hustler US jde skrýt a posunout; pořadí vydrží
      restart.

## 0.02.016 – Kalendář podle časopisu

- [ ] **Kritérium hotovo:** Čísla › Kalendář › „Časopis a edice: Penthouse US“: ukáže Penthouse 09/1985 a v roce
      1985 ostatní měsíce jako chybějící s +; klik na + nabídne přidání čísla Penthouse.
- [ ] Volba se pamatuje po restartu; přepnutí zpět na Playboy US ukáže Kalendář jako dřív.
- [ ] Obálky (Čísla › Obálky) mají stejnou volbu; „Chybějící“ u Penthouse počítá podle řady Penthouse.
- [ ] Penthouse UK bez čísel: „Penthouse UK: zatím žádné číslo“ s tlačítkem Přidat….
- [ ] Nabídka ročníku Penthouse (klik na rok): bez „Ročník podle Wikipedie…“, s „Nový speciál…“.
- [ ] Po přepnutí Kalendáře na Penthouse nabídne nové album Penthouse US (dokud se neuloží jiný časopis).

## 0.02.015 – Řady Penthouse a Hustleru

- [ ] **Kritérium hotovo:** ročník Penthouse 1969 (drobeček „Ročník 1969 · Penthouse“ u čísla 09/1969): leden až
      srpen „nevyšlo“, září až prosinec jako chybějící s +, „Čísel ve sbírce … z 4“.
- [ ] Ročník Penthouse 1985: 12 měsíců, Penthouse UK 1965: od března.
- [ ] Zkontroluj na svých výtiscích, jestli data řad sedí (hlavně konec Penthouse US a UK); oprava je jen
      v `frontend/src/lib/rady-cisel.js`.

## 0.02.014 – Řady čísel jako data

- [ ] Nic nového k vidění: Kalendář US (03/1955 „nevyšlo“, ročník 1953 jen prosinec, konec 03/2020), Kalendář CZ
      (od 07/2011), Mapa čísel a kapesní katalog vypadají jako dřív.

## 0.02.013 – Správa časopisů

- [ ] **Kritérium hotovo:** ⋯ › Časopisy… › + Nový časopis: Oui, zkratka OU, edice „US, FR“, Girl of the Month →
      Přidat; v okně alba je hned „Oui US“ a „Oui FR“ a album k Oui FR 05/1980 se uloží.
- [ ] Úprava Penthouse: změna barvy a titulu se uloží; ubrat edici UK, když má sbírka číslo Penthouse UK, nejde
      (hláška).
- [ ] Smazat Penthouse s čísly ve sbírce nejde; nepoužitý Hustler smazat jde (s potvrzením).
- [ ] Playboy: tlačítko Smazat chybí, edice nejdou měnit, název a tituly ano.
- [ ] Okno v úzkém okně programu: seznam i formulář se posouvají uvnitř, nic nepřetéká.

## 0.02.012 – Kategorie a filtry podle časopisu

- [ ] **Kritérium hotovo:** hledání `kategorie:"pet of the month"` najde modelku s centerfoldem Penthouse;
      `kategorie:"playmate mesice"` ji nenajde.
- [ ] Modelka jen s pictorialem Pet of the Month (bez centerfoldu): v profilu „Pet of the Month“, žádná Playmate.
- [ ] Pictorial Pet of the Year u čísla Penthouse 1986: kategorie „Pet of the Year 1986“.
- [ ] Galerie › filtr Kategorie nabízí Pet of the Month s počtem modelek; Statistiky › Kategorie ji ukazují.
- [ ] Úprava modelky: odvozené kategorie (šedé) ukazují Pet of the Month.
- [ ] Playmate jen z Playboye: kategorie, hledání `pmom` a filtry jako dřív.

## 0.02.011 – Typy alb podle časopisu

- [ ] **Kritérium hotovo:** okno alba, Časopis a edice = Penthouse US: druhy „Pictorial · Pet of the Month ·
      Pet of the Year · Centerfold“; přepnutí na Playboy US vrátí „Playmate of the Month / Year“.
- [ ] Zvolený druh zůstane zvolený i po přepnutí časopisu (Pet of the Month → Playmate of the Month).
- [ ] Album „Pet of the Month“ k Penthouse 09/1985 se uloží; v profilu pod názvem „Pictorial Pet of the Month“.
- [ ] Ze stránky čísla Penthouse › přidat pictorial: okno rovnou nabízí Pet of the Month.
- [ ] Známé omezení do 0.02.012: modelka s pictorialem Pet of the Month dostane v kategoriích i „Playmate měsíce“.

## 0.02.010 – Titul v profilu

- [ ] **Kritérium hotovo:** profil modelky jen s centerfoldem Penthouse 09/1985: v kategoriích „Pet of the Month“,
      na pásce čísla „Pet · Zář 85 · PH“, slovo „Playmate“ nikde v profilu.
- [ ] Modelka s centerfoldem Playboye i Penthouse: kategorie „Playmate měsíce“ i „Pet of the Month“, páska
      „Playmate · …“ u čísla Playboye a „Pet · …“ u Penthouse.
- [ ] Profil Playmate jen z Playboye vypadá jako dřív.
- [ ] Najetí na štítek čísla Penthouse: v bublině řádek „Pet“ místo „Playmate“.
- [ ] Stránka čísla Penthouse › Jako časopis: nadtitulek „Pet of the Month · Září 1985 · Penthouse“.

## 0.02.009 – Tituly podle časopisu

- [ ] Nic viditelného: funkce titulů je ověřená testy, rozhraní ji použije od 0.02.010. Stačí, že se program
      spustí a Playboy vypadá jako dřív.

## 0.02.008 – Export a import verze 14

- [ ] **Kritérium hotovo:** ⋯ › Exportovat; v souboru je `verze: 14`, oddíl `casopisy` a číslo `1985-09@PH`.
- [ ] Ten soubor načti importem do čisté sbírky (nebo po záloze): centerfold Penthouse 09/1985 je u modelky,
      cover čísla na stránce čísla, stav a poznámka čísla zůstaly.
- [ ] Starý export z Playboy Database (verze 13) se načte bez chyb; všechna čísla jsou Playboy.
- [ ] Ručně upravený export s `casopisy: - {klic: OU, nazev: Oui, edice: [US, FR]}` založí časopis Oui;
      v okně alba pak nabídka „Oui US“ a „Oui FR“.

## 0.02.007 – Pohledy Playboye beze změny

S centerfoldem Penthouse 09/1985 ve sbírce (z 0.02.005):
- [ ] Kalendář a Obálky (US i CZ) a Mapa čísel: září 1985 ukazuje jen Playboy, Penthouse nikde.
- [ ] Centerfoldy (stěna) ve volbě „vše“, US i CZ: fotka Penthouse tam není.
- [ ] Kapesní katalog (vše / CZ / sháním): žádné číslo Penthouse.
- [ ] Statistiky: desetiletí 1980 počítají stejně jako předtím; modelka jen s Penthouse v grafech roku není.
- [ ] Rok ve sbírce: dokončené ročníky jen Playboye.
- [ ] Stránka čísla Playboy 09/1985: Předchozí/Další vedou na 08 a 10/1985 Playboye.

## 0.02.006 – Rychlé přidání a stránka čísla jiného časopisu

- [ ] **Kritérium hotovo:** v profilu modelky s centerfoldem Penthouse 09/1985 klik na číslo otevře stránku
      „Září 1985 · Penthouse“; úplnost čísla nenabízí „Playmate měsíce podle Wikipedie“.
- [ ] Drobeček „Ročník 1985 · Penthouse“ otevře ročník Penthouse (jen jeho čísla, chybějící měsíce s +).
- [ ] Ctrl+Shift+N: volba „Časopis a edice“ v řádku čísla; nová modelka s Penthouse US 10/1985 dostane centerfold
      „Říjen 1985 · Penthouse“; další otevření nabídne Penthouse.
- [ ] Upravit číslo… u Penthouse: název v záhlaví, stav „Mám výtisk / Sháním“ se nenabízí (jen CZ).

## 0.02.005 – Volba „Časopis a edice“ (Hotovo, když: Penthouse 09/1985)

- [ ] **Kritérium hotovo:** u modelky přidej album typu Centerfold, Září 1985, **Penthouse US**, s odkazem na fotku;
      uloží se a v profilu se jmenuje „Září 1985 · Penthouse“.
- [ ] Cover Penthouse 09/1985 jde přidat; v Kalendáři (Playboy US) se **neukáže**.
- [ ] Pictorial přiřazený k Penthouse UK 03/1986 se uloží; speciál „Nový speciál…“ pro Penthouse vznikne.
- [ ] Další nové album nabídne Penthouse US (pamatuje se), Playboy alba se zadávají jako dřív.
- [ ] Okno alba a coveru: řádek měsíc · rok · časopis se vejde i v úzkém okně.

## 0.02.004 – Názvy čísel podle časopisu

- [ ] Odkaz `[[09/1985@PH]]` v poznámce teď ukazuje „Září 1985 · Penthouse“ (dřív „· PH“).
- [ ] Názvy a pásky čísel Playboye všude beze změny (dlaždice Čísel, profil, Kalendář, speciály).

## 0.02.003 – Tabulka časopisů (úprava databáze č. 17)

- [ ] Po instalaci a prvním spuštění: program se otevře normálně, sbírka je celá a v ⋯ › Obnovit ze zálohy
      přibyla záloha „Před úpravou“ (pred-migraci) s dnešním datem.
- [ ] Obnovení starší zálohy (před 0.02.003) funguje – databáze se po obnovení znovu upraví.
- [ ] (volitelně) `sqlite3 ~/.local/share/pinup-katalog/playboy.db "SELECT * FROM casopisy"` ukáže Playboy,
      Penthouse a Hustler.

## 0.02.002 – Klíč čísla v rozhraní

Číslo jiného časopisu zatím nejde zadat v okně (přijde v 0.02.005); zkoušet jde jen odkaz v textu.

- [ ] Do poznámky modelky napiš `[[09/1985@PH]]`: odkaz se ukáže jako číslo (klik otevře zatím prázdnou stránku
      čísla „Září 1985 · PH“) a nerozbije se.
- [ ] Odkazy `[[06/1995]]` a `[[06/2012 CZ]]` fungují jako dřív, „Zmiňováno v…“ u čísla taky.
- [ ] Názvy čísel Playboye všude beze změny (Listopad 2009, Listopad 2009 · CZ, speciály).

## 0.02.001 – Klíč čísla s časopisem (jen jádro)

V okně se nic nového neukazuje (výběr časopisu přijde v 0.02.005); jde jen o to, že Playboy funguje jako dřív.

- [ ] Kalendář, Mapa čísel, stránka čísla i celého ročníku (klik na rok v Kalendáři) ukazují stejná čísla jako dřív.
- [ ] Založení speciálu (okno alba nebo coveru › Speciál › Nový) funguje pro US i CZ.
- [ ] Hledání `edice:cz` najde stejné modelky jako dřív.

## 0.01.001 – Pinup Katalog (přejmenování a verze X.XX.XXX)

Program se jmenuje Pinup Katalog a verze začínají znovu; oddíly níže (1.xx) jsou z Playboy Database.
Před zkoušením **zavři Playboy Database** (běžící stará verze přesun odloží).

- [ ] `git pull` není potřeba (je to místní commit), stačí `./instalovat.sh`: v nabídce aplikací je
      „Pinup Katalog“ s ikonou a „Playboy Database“ zmizela.
- [ ] Po prvním spuštění je sbírka celá: modelky, hodnocení, zálohy (⋯ › Obnovit ze zálohy ukáže staré zálohy).
- [ ] Nastavení okna přežilo (Vzhled, zapamatovaná sekce, historie hledání, Mapa sbírky) – je v localStorage,
      který se přesunul se složkou.
- [ ] `~/.local/share/playboy-app` a `~/.cache/playboy-app` už neexistují, místo nich `pinup-katalog`; náhledy
      se nestahují znovu.
- [ ] Po startu se ukáže „Co je nového · verze 0.01.001“ (jen jednou); verze na úvodní obrazovce a v ⋯ je
      ve tvaru 0.01.001.
- [ ] Název okna, úvodní obrazovka a Alt+Tab ukazují Pinup Katalog; okno se spáruje s ikonou v panelu.
- [ ] ⋯ › Zkontrolovat novou verzi: dokud na GitHubu není 0.1.0, napíše „Ve vzdáleném repozitáři se nepodařilo
      najít verzi programu“ (stará řada 1.53 se za novější nebere); po push „Máš nejnovější verzi“.
- [ ] Export sbírky nabídne název `pinup-katalog-RRRR-MM-DD.yaml` a import staršího exportu funguje.

## 1.53.0 – Statistiky, mapa a vkus 2

Graf Můj vkus v čase ani kartu Objevit jsem neviděl vykreslené (potřebují data sbírky) – projít pozorně.

- [ ] **Kritérium hotovo:** Mapa sbírky s celou sbírkou se otevře bez zaseknutí, posouvání stránky i bublina nad
      body jsou plynulé (nad 2 000 modelek je to plátno); laso a klik na bod fungují jako dřív.
- [ ] Pod mapou: model, posun (po přidání pár modelek malý), „Zachovaní sousedé“ se doplní po chvíli,
      „Zkouším autoenkodér… n/40“ doběhne a napíše výsledek; okno se mezitím nezasekává.
- [ ] **Přepočítat od začátku** mapu spočítá znovu s pevnou orientací (starší vlevo, vyšší nahoře).
- [ ] **Můj vkus v čase** (Statistiky › Srovnání): věty, graf po měsících a tabulka dávají smysl; při málo
      porovnáních srozumitelná hláška. Ukáže aspoň jeden průkazný posun, pokud v datech je?
- [ ] Změna srdíček modelky se od teď zapíše: po pár změnách je v tabulce „Srdíčka po měsících“.
- [ ] Karta **Objevit** v Přehledu: modelky s odhadem a důvodem v bublině, alba (s obsahem fotek), klik otevře
      profil; v ⋯ › Vzhled jde skrýt a přesunout.
- [ ] **PNG**, **CSV**, **Tisk** u grafu: PNG vypadá jako graf (i mapa na plátně), CSV se otevře v LibreOffice
      s čárkami v číslech, tisk ukáže jen graf.

## 1.52.0 – Hledání a výběry 2

- [ ] **Kritérium hotovo:** `foto:"bazén" výška > 175` v Galerii modelek najde správné modelky (otevřít pár profilů a
      podívat se, jestli bazén na fotkách opravdu mají). Kolik nalezených je omylem? Podle toho doladit práh.
- [ ] Bez zapnutého obsahu fotek: `foto:"…"` nic neomezí a jednou se ukáže oznámení.
- [ ] `blond nebo zrzka`, `(70. léta | 80. léta) výška > 175`, `-(blond | zrzka)` najdou totéž v Modelkách,
      Centerfoldech a Kalendáři; pod polem je srozumitelná věta „Hledám: …“.
- [ ] Panel Filtry s dotazem se závorkami: štítky a počty dávají smysl, zápis se nerozbije.
- [ ] Historie: klik do prázdného pole ukáže poslední dotazy, šipky + Enter dotaz vloží, Shift+Delete ho smaže,
      vydrží restart.
- [ ] `Ctrl+S` v poli hledání uloží dotaz jako výběr ⚡ (oznámení s Upravit), nekoliduje s ničím jiným.
- [ ] Výběr ⚡: po přidání modelky, která podmínkám vyhoví, ukáže „+1“; klik na výběr ohlásí přírůstek a odznak zmizí.
- [ ] Okno výběru (✎): Jako časopis, Prezentace (listuje sama), Dnešní výběr porovnává jen modelky výběru.

## 1.51.1 – Hromadně s rozdílem nanečisto

- [ ] Lišta „Zobrazeno N“ je ve všech režimech na stejném místě a při posouvání zůstává nahoře.
- [ ] Z webu › Přijmout zobrazené: okno ukáže všechny řádky (teď → potom), Zrušit nic nezmění, po přijetí
      Vrátit vrátí údaje modelek i návrhy do fronty.
- [ ] Otočit zobrazené, Použít zobrazené návrhy výřezů, Vyměnit zobrazené za lepší, Sloučit jistě stejné:
      rozdíl odpovídá, Vrátit vrátí všechno.
- [ ] Fronta: hromadné Netýká se / V pořádku a přijetí jistých návrhů ukáže rozdíl; Esc okno zavře bez akce.

## 1.51.0 – Údržba Dnes a kvalita fotek

Vzhled režimu Dnes jsem neviděl ani ve skrytém WebKitu (potřebuje data sbírky) – projít pozorně.

- [ ] Údržba se otevře v režimu **Dnes** (kdo měl zapamatovaný jiný režim, zůstane v něm).
- [ ] Pokrok dne: po vyřízení pár úkolů (doplnit údaj, přijmout návrh) číslo naroste; přidání modelky ho nesníží;
      zítra začne od nuly a série ukáže 2 dny.
- [ ] Klik na modelku v „Nejcennější ve frontě“ otevře Po modelkách přímo na ní; rychlé dávky přepnou režim.
- [ ] Panel **Na pozadí**: stavy odpovídají; Spustit / Pozastavit u náhledů, obsahu, otisků, otočení a kvality
      funguje a průběh se sám obnovuje; připomínka průchodu webem (ještě neproběhl / starší 60 dní).
- [ ] **Kvalita fotek**: „Zkontrolovat kvalitu“ doběhne (u celé sbírky může stahovat chybějící náhledy).
      Projít aspoň 50 hlášených fotek a spočítat, kolik je opravdu slabých – podle toho doladit prahy v
      `kvalita_fotek.go` (rozmazané 12, přepálené 0,30, tmavé 0,60 + jas 40). Staré měkké fotky ze 70. let
      se možná budou hlásit jako rozmazané.
- [ ] **Vyměnit za lepší**: v albu zůstane lepší soubor, srdíčka a tagy přejdou, Vrátit vrátí původní.

## 1.50.0 – Klid, pohyb a vlastní Přehled

- [ ] **Pohyb Žádné**: projít všechny sekce, profil, prohlížeč fotek (slideshow), režim čtení, Dnešní výběr,
      nabídky a okna – nic se nehýbe ani neprolíná a nic se kvůli tomu nezasekne (okno, které by čekalo
      na konec animace).
- [ ] **Pohyb Omezené**: v režimu čtení bez Ken Burns, posouvání na místo (např. skok na album) je okamžité.
- [ ] Prohlížeč fotek, pozadí **Rozmazaná fotka**: rozmazaná fotka se mění s listováním a nebrzdí ho.
- [ ] Prohlížeč, **ovládání Trvale**: horní lišta a lišta alb zůstanou vidět i bez pohybu myši.
- [ ] **Filmový pás**: náhledy dole, zvýrazněná aktuální fotka uprostřed, kliknutí přejde na fotku; lišta alb
      je nad pásem; při lupě a v hodnocení nehodnocených pás není.
- [ ] **Po startu otevřít** Čísla / Sbírku / Poslední sekci: po restartu se otevře správná sekce (i se zámkem
      po odemčení).
- [ ] **Záhlaví profilu** Jen pruh: profil se otevře rovnou se svinutým záhlavím; Vysoké stále se nesvine ani
      po odrolování; úprava výřezu fotky záhlaví funguje ve všech třech volbách.
- [ ] **Karty Mapy čísel**: skrytí a přeskládání se v Sbírce › Mapa čísel projeví po zavření okna Vzhled.

## 1.49.0 – Přiblížení, hustota a karty

Přiblížení je CSS `zoom` na celé stránce (Wails na Linuxu jiné nemá). Ve skrytém WebKitGTK jsem ověřil, že okna
s výškou okna se vejdou a že plovoucí nabídky sedí na tlačítko; v celém programu to ověřené není.

- [ ] ⋯ › **Vzhled…** otevře okno; posuvník přiblížení mění velikost hned a ukazuje procenta.
- [ ] `Ctrl` + numerické `+` / `-` mění přiblížení po 10 % s oznámením, `Ctrl` + `0` vrátí 100 %.
- [ ] `Ctrl` + `1`…`9` dál přepínají sekce (na české klávesnici je na `1` znak „+“ – nesmí přibližovat).
- [ ] Při **150 %** projít: Galerie modelek, profil modelky, Všechny fotky, Centerfoldy, Kalendář, Statistiky (grafy,
      hero, mapa), Údržba, Hodnocení, okna (Nastavení, Rok ve sbírce, Kapesní katalog). Nic nepřetéká mimo okno,
      mřížky se nerozpadají, okna jdou posouvat.
- [ ] Při 150 % sedí na místě: pravé tlačítko (kontextová nabídka), panel filtrů, nabídka ⋯ u čipů, bublina
      odkazu `[[…]]`, bublina čísla, štítky fotek, bubliny grafů ve Statistikách, bublina v Síni slávy,
      našeptávač v editoru textu, mapa obálky.
- [ ] Při 150 % funguje tažení (výřez titulní, řazení, laso ve Statistikách) – kurzor drží tažený prvek.
- [ ] Úzké okno (přes půl obrazovky) při 130–150 %.
- [ ] **Hustota Kompaktní**: v Údržbě je na stejné obrazovce aspoň o 30 % víc řádků než v Pohodlné
      (spočítej řádky na jedné obrazovce v obou).
- [ ] Velikost karet **Malé / Střední / Velké** zvlášť pro Karty modelek, Všechny fotky (výška řady mozaiky)
      a Centerfoldy.
- [ ] Na kartě modelky: vypnutí srdíček je skryje; rok prvního čísla a počet fotek se ukážou vedle jména
      (u modelky bez čísla jen počet fotek). Dlouhé jméno se zkrátí, údaje zůstanou vidět.
- [ ] **Výchozí** vrátí vše; volby vydrží po restartu programu.
- [ ] Malé karty modelek: jméno je čitelné.

## 1.48.0 – Nová verze

- [ ] Po reinstalaci přes `./instalovat.sh`: ⋯ › Nápověda › **Zkontrolovat novou verzi** napíše „Máš nejnovější verzi“.
- [ ] Bez internetu kontrola napíše chybu spojení a program nezamrzne (nejvýš 15 s).
- [ ] Vypnutí „Hledat novou verzi každý den“ vydrží restart.
- [ ] (až vyjde další verze v repozitáři) oznámení minutu po startu, okno Co je nového, Kopírovat příkaz.

## 1.47.0 – Kapesní katalog

- [ ] ⋯ › Zálohy a data › Kapesní katalog: počty a velikost u rozsahů odpovídají.
- [ ] Uložená složka nahraná do **telefonu** se otevře v prohlížeči bez připojení, náhledy obálek se ukážou,
      hledání a filtr mám / sháním / chybí fungují, světlý i tmavý režim telefonu.
- [ ] Otevřít složku z oznámení otevře správce souborů.

## 1.46.0 – Rok ve sbírce

- [ ] Statistiky › Rok ve sbírce →: čísla roku odpovídají tvé představě (fotky, modelky, série dní).
- [ ] **Tisk / PDF** otevře tiskový dialog WebKitGTK a výsledné PDF má rozumné stránky (nic neuříznuté).
- [ ] **Jako časopis** projde přehled v režimu čtení.

## 1.45.0 – Otočené fotky

- [ ] Údržba › Otočené fotky: projít vzorek aspoň 50 fotek a spočítat, kolik je opravdu otočených. Podle toho
      se doladí práh `prahOtoceni` (teď 0,02) v opravě 1.45.x.
- [ ] Návrh výřezu titulní (tlačítko Navrhnout ve výřezu) vybere rozumný výřez.
