# K vyzkoušení

Co jde ověřit jen v opravdovém programu (testy a sestavení prošly, ale okno, tisk ani síť se automaticky nezkouší).
Hotové body odškrtni `[x]`; co nefunguje, napiš pod bod. Nové verze se přidávají nahoru.

Před zkoušením nainstaluj aktuální verzi: `./instalovat.sh` ve složce programu.

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
