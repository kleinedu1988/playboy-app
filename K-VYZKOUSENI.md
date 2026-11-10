# K vyzkoušení

Co jde ověřit jen v opravdovém programu (testy a sestavení prošly, ale okno, tisk ani síť se automaticky nezkouší).
Hotové body odškrtni `[x]`; co nefunguje, napiš pod bod. Nové verze se přidávají nahoru.

Před zkoušením nainstaluj aktuální verzi: `./instalovat.sh` ve složce programu.

## 0.1.0 – Pinup Katalog (přejmenování)

Program se jmenuje Pinup Katalog a verze začínají znovu; oddíly níže (1.xx) jsou z Playboy Database.
Před zkoušením **zavři Playboy Database** (běžící stará verze přesun odloží).

- [ ] `git pull` není potřeba (je to místní commit), stačí `./instalovat.sh`: v nabídce aplikací je
      „Pinup Katalog“ s ikonou a „Playboy Database“ zmizela.
- [ ] Po prvním spuštění je sbírka celá: modelky, hodnocení, zálohy (⋯ › Obnovit ze zálohy ukáže staré zálohy).
- [ ] Nastavení okna přežilo (Vzhled, zapamatovaná sekce, historie hledání, Mapa sbírky) – je v localStorage,
      který se přesunul se složkou.
- [ ] `~/.local/share/playboy-app` a `~/.cache/playboy-app` už neexistují, místo nich `pinup-katalog`; náhledy
      se nestahují znovu.
- [ ] Po startu se ukáže „Co je nového · verze 0.1.0“ (jen jednou).
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
