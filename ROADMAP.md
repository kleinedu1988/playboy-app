# Pinup Katalog – Roadmapa

Plán vývoje od přejmenování na Pinup Katalog. Do verze 1.53.0 se program jmenoval **Playboy Database**; jeho celý
plán a historie jsou v [docs/archiv/ROADMAP-PLAYBOY-DATABASE.md](docs/archiv/ROADMAP-PLAYBOY-DATABASE.md) a
[docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md](docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md). Odkazy „ROADMAP 1.xx“
v komentářích kódu a značka **PD 1.xx** níže míří do archivní roadmapy (verze Playboy Database), ne do nové řady.

**Stav (12. 11. 2026): verze 0.02.065** – program přejmenovaný, verzování začíná znovu; jádro v Go i rozhraní znají klíč
čísla s časopisem (`1985-09@PH`), databáze má tabulku časopisů (úprava č. 17), čísla se jmenují podle časopisu
a v okně alba, coveru i rychlém přidání jde vybrat časopis; pohledy Playboye čísla jiných časopisů neukazují.
Export (verze 14) nese časopisy a profil, okno alba, kategorie i hledání znají titul modelky podle časopisu (Playmate, Pet,
Honey); časopisy jde spravovat v ⋯ › Časopisy…. Řady čísel jsou data podle řady (`lib/rady-cisel.js`) i pro Penthouse a Hustler; Kalendář
a Obálky jdou přepnout na jiný časopis, Mapa čísel má kartu pro každý časopis, stěna Centerfoldů volbu časopisu a hledání zná
`casopis:`. Statistiky, Postřehy, Síň slávy a zbylé texty mluví podle časopisu; Kalendář, Obálky a Centerfoldy
mají hero. Profil ukazuje kariéru napříč časopisy a přezdívky podle
časopisu. Modelka se najde pod
kteroukoli přezdívkou. Údržba hlásí kandidáty na sloučení i s důvody
z fotek; odhad srdíček dostane modelka až po první galerii a importované vydání bez časopisu se řídí alby. Sloučení
modelek má rozdíl nanečisto a Vrátit; štítky profilu mají jednotnou strukturu časopis → role → profese; PDF čísla jde otevřít a listovat; album bez čísla bere časopis z údajů
modelky.

**Od 11. 11. 2026 přednost má ladění** (přání uživatele): nové funkce (web, vkus napříč časopisy, mobil) počkají,
napřed se dotáhne vykreslování, grafika a správné napojení toho, co už je. Další na řadě je
**0.02.066 – Zásobník odkazů** (Údaje z webu pro další časopisy; snímky obrazovek: `go test -tags snimky`, úlohy v `nastroje/snimky/`).

---

## Pravidlo verzování

Formát **X.XX.XXX** = `MAJOR.MINOR.PATCH` s pevnou šířkou: MAJOR jedna číslice, MINOR dvě (00–99), PATCH tři
(000–999), např. `0.02.003`, `1.00.000`. Bez čtvrté části. Tak se verze píše v programu, v CHANGELOG.md, v této
roadmapě a v K-VYZKOUSENI.md. V `verze.go`, `wails.json` a `package.json` je stejná verze zapsaná bez nul na začátku
(`0.2.3`), protože SemVer, npm a Wails nuly nepřijmou; převod dělá `zobrazitVerzi` (test `TestVerzeSouhlasi`).
**Malé kroky:** každá verze PATCH (`0.02.001`, `0.02.002`…) je jeden malý krok – pár hodin práce, samostatně
vydatelný, s vlastním „Hotovo, když“ a oddílem v K-VYZKOUSENI.md. Skupina kroků jednoho tématu je MINOR (`0.02`);
její `.000` se nevydává, první vydaná verze tématu je `.001`. Krok, který by vyšel větší, se před začátkem rozdělí.
Opravy chyb dostanou další volné číslo PATCH v tématu, které se zrovna dělá.

- **0.xx.xxx – přechod na víc časopisů** (etapa U): MINOR = téma přechodu, PATCH = krok.
- **1.00.000 – první vydání Pinup Katalogu:** přechod hotový, ověřený na sbírce se dvěma časopisy.
- **1.xx.xxx po 1.0:** MINOR = téma z plánu, PATCH = krok; MAJOR = velký milník.
- Kompatibilitu dat dál hlídá číslo úpravy schématu DB a verze exportu (`TestZmrazeniAlfy`), ne verze programu.
  Číslování úprav schématu a verzí exportu pokračuje z Playboy Database (nezačíná znovu). Krok se změnou
  schématu nebo exportu je označený **[schéma]** / **[export]** a dělá jen ji.

Verze se drží synchronně v: `verze.go`, `wails.json`, `frontend/package.json`, `frontend/package-lock.json`,
`frontend/package.json.md5` a `CHANGELOG.md`. Kontrola nové verze (`aktualizace.go`) bere jen vzdálenou větev,
jejíž `verze.go` má `NazevProgramu` – starou řadu 1.x Playboy Database za novější nepovažuje.

---

## Přehled etap

| Etapa | Verze | Stav | Název | Hlavní přínos |
|---|---|---|---|---|
| PD | 0.1–1.53 | ✅ Hotovo | Playboy Database | Celý dosavadní program (archivní roadmapa) |
| **U** | **0.01–0.02** | 🚧 0.01 hotová, 0.02.001–0.02.065 hotové | **Univerzální katalog** | Modelky v centru, časopis jen jako místo publikace: Playboy, Penthouse, Hustler… |
| **1.0** | **1.00.000** | 📋 Plán | **První vydání Pinup Katalogu** | Přechod ověřený na skutečné sbírce |
| **H** | **1.01** | 📋 Plán | **Prohlížení a časopis 2** | Zbytek etapy H z Playboy Database (PD 1.54) |
| **I** | **1.02–1.05** | 📋 Plán | **Sbírka výtisků** | PD 1.55–1.58 |
| **J** | **1.06–1.10** | ⏸ Odloženo | **Kvíz, průvodce číslem, Google Disk a světlý motiv** | PD 1.59–1.63 |

---

## Etapa U – Univerzální katalog (0.01–0.02)

**Cíl:** jedna modelka = jeden profil s celou kariérou, ať vyšla v Playboyi, Penthouse, Hustleru nebo jinde. Časopis
je nový údaj čísla vedle edice (edice = země vydání: US, CZ, UK…). Playboy zůstává výchozí, takže stávající data
se nemění; po každém kroku program funguje celý.

**Výchozí stav (zjištěno 10. 11. 2026):** vydání je text `RRRR-MM[-EDICE]` (`rozlozitVydani` ve
`frontend/src/lib/format.js`, v Go `sbirka.CastiVydani`, `uceni.CastiVydani`, `hledani.JePlatneVydani`,
`rozlozitRocnik`, `edicePodleVydani`, `zminky.go`). Rozkládá se na ~60 místech v JS a ~30 v Go; pohledy podle
edice porovnávají `edice === 'US' | 'CZ'`. Pojmy Playboye (Playmate, PMOY) jsou v kódu ~370× – většinou popisky.

**Návrh klíče:** `RRRR-MM[-EDICE][@ČASOPIS]`, např. `1985-09@PH`, `1986-03-UK@PH`; bez `@` = Playboy. Rozklad vrací
navíc `casopis` a `zeme` a pole `edice` u jiného časopisu než Playboy obsahuje **řadu** `PH/US`. Pohledy, které
porovnávají `edice === 'US'`, tak čísla jiných časopisů samy vynechají (Kalendář, Mapa čísel, Centerfoldy, sousední
čísla) a `slozitVydani` z řady složí klíč zpátky. Volba „Edice“ ve formulářích se změní na „Časopis a edice“
(Playboy US, Playboy CZ, Penthouse US…) se stejnou hodnotou.

#### 0.01 – Přejmenování a nové verzování ✅ (10. 11. 2026)

| Verze | Krok |
|---|---|
| 0.01.000 ✅ | Pinup Katalog (okno, nabídka, nápověda, export, Go modul), přesun dat a mezipaměti (`prejmenovani.go`), `instalovat.sh` odebere starý program, kontrola nové verze ignoruje starou řadu, starý plán a changelog v `docs/archiv/` |
| 0.01.001 ✅ | Verze s pevnou šířkou X.XX.XXX (`zobrazitVerzi`) |

#### 0.02 – Časopis jako údaj čísla, řady čísel a pohledy podle časopisu

Na přání se celá zbývající etapa U čísluje pod 0.02: kroky 0.02.014–0.02.019 byly původně etapa 0.03 (Řady čísel
a Mapa čísel), od 0.02.020 pokračují dřívější etapy 0.03–0.08 (v nadpisech je jejich původní číslo). Po alfě
přijde 1.00.000.

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.001 ✅ | **Klíč čísla s časopisem v Go:** `JePlatneVydani`, `VzorVydani`, `VzorVydaniAlba`, `CastiVydani` (sbirka i uceni), `EdicePodleVydani`, `rozlozitRocnik` přijmou `@XX` a vrátí řadu `PH/US`; jedna sdílená funkce `RozdelitCasopis` v `internal/hledani`; navíc kontrola edice při ukládání alba a `ZalozitSpecial` | testy na všechny tvary klíče; všechny stávající testy projdou beze změny |
| 0.02.002 ✅ | **Klíč čísla v rozhraní:** `rozlozitVydani` / `slozitVydani` s časopisem a řadou, `odkazy.js` a `zminky.go` (`[[09/1985@PH]]`, `[[09/1985 UK@PH]]`; „PH“ za lomítkem by se pletlo s edicí) | testy v `test/etapa2.test.js` a `test/odkazy.test.js`; klíč projde rozložením a složením beze změny |
| 0.02.003 ✅ | **Tabulka časopisů [schéma č. 17]:** `casopisy` (klíč = zkratka, název, barva, edice, „modelka měsíce“, „modelka roku“, pořadí); Playboy, Penthouse a Hustler předvyplněné; `GetCasopisy`; ukládání čísla jiného časopisu jen s časopisem a edicí z tabulky | stará databáze se převede se zálohou; `TestZmrazeniAlfy` hlídá č. 17 |
| 0.02.004 ✅ | **Názvy čísel:** registr časopisů v rozhraní (jako názvy speciálů); `nazevVydani` → „Září 1985 · Penthouse“, páska „Zář 85 · PH“, `nazevRady`, hledání `rok:1985-09@PH` (`casopis:` a hledání názvem časopisu je 0.02.019) | Playboy čísla vypadají přesně jako dřív (test) |
| 0.02.005 ✅ | **Volba „Časopis a edice“** v okně alba a coveru: možnosti z tabulky časopisů, výchozí Playboy US, pamatuje poslední | jde uložit album Penthouse 09/1985 typu Centerfold |
| 0.02.006 ✅ | **Rychlé přidání a okno Číslo:** stejná volba v rychlém přidání modelky; okno a stránka čísla jiného časopisu (bez kalendáře a mapy) | Penthouse 09/1985 jde otevřít z profilu modelky |
| 0.02.007 ✅ | **Playboy pohledy beze změny:** projít Kalendář, Mapu čísel, Centerfoldy, kapesní katalog, Rok ve sbírce, úplnost čísla a Statistiky; čísla jiných časopisů v nich nejsou, test na každý | záloha sbírky před a po 0.02 – žádný rozdíl v Číslech a Statistikách |
| 0.02.008 ✅ | **Export a import [export 14]:** časopisy a čísla s `@` v exportu, EXPORT.md; starší export = Playboy | export → import vrátí stejnou sbírku (test) |
| 0.02.009 ✅ | **Tituly podle časopisu** (předřazeno z etapy Pojmy podle časopisu na přání): `titulCasopisu` / `titulCisla` ve `format.js` – Playmate měsíce / roku, Pet of the Month / Year, Honey of the Month / Year a krátký titul (Playmate, Pet, Honey) z tabulky časopisů | test pro všechny tři časopisy |
| 0.02.010 ✅ | **Profil a karty modelky:** štítek titulu podle časopisu čísla („Pet · Září 1985 · Penthouse“) | u Pet of the Month není nikde „Playmate“ v profilu |
| 0.02.011 ✅ | **Typy alb:** „Playmate měsíce / roku“ v okně alba podle zvoleného časopisu (Pet of the Month…) | okno alba Penthouse nabízí Pet of the Month |
| 0.02.012 ✅ | **Kategorie a filtry:** odvozená kategorie podle časopisu centerfoldu (Pet of the Month místo Playmate měsíce), fasety galerie a hledání `kategorie:` | filtr „Pet of the Month“ funguje; modelka jen z Penthouse není Playmate |
| 0.02.013 ✅ | **Správa časopisů** v ⋯ › Časopisy…: přidat, přejmenovat, barva, edice, názvy modelky měsíce a roku; smazat jen nepoužitý | nový časopis (např. Oui) jde přidat a hned vybrat v okně alba |
| 0.02.014 ✅ | **Řady čísel jako data:** `RADY_EDIC` a `NEVYSLA_CISLA` do jednoho datového souboru podle řady; Playboy převedený beze změny chování | testy řad Playboye projdou beze změny |
| 0.02.015 ✅ | **Řady Penthouse a Hustler:** Penthouse US od 09/1969, UK od 1965, Hustler od 07/1974 (z Wikipedie, s poznámkou zdroje) | `cisloNevyslo` a `ciselRocniku` fungují pro Penthouse |
| 0.02.016 ✅ | **Kalendář podle časopisu:** přepínač časopisu vedle edice, pamatuje se | Kalendář Penthouse ukáže zadaná čísla a díry |
| 0.02.017 ✅ | **Mapa čísel:** karta pro každý časopis, který ve sbírce je, skrývání a pořadí v ⋯ › Vzhled | úplnost Penthouse i Playboye zvlášť |
| 0.02.018 ✅ | **Centerfoldy (stěna) podle časopisu** | stěna Pet of the Month Penthouse |
| 0.02.019 ✅ | **Hledání:** `casopis:penthouse`, zkratky `pb`/`ph`/`hu`, čip a našeptávání; chytré výběry | `casopis:penthouse 80. léta` najde správné modelky |

#### Pojmy podle časopisu (0.02.020–0.02.022, dříve etapa 0.03)

Tituly (funkce, profil, typy alb, kategorie a filtry) se předřadily do 0.02.009–0.02.012.

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.020 ✅ | **Statistiky a Postřehy:** texty podle časopisu, Playboy beze změny | žádný „Playmate“ u dat Penthouse |
| 0.02.021 ✅ | **Síň slávy, sezóny, Rok ve sbírce:** přes všechny časopisy s filtrem časopisu | Síň slávy jde přepnout na Penthouse |
| 0.02.022 ✅ | **Zbylé texty:** nápověda, prázdné stavy, úvod, kvíz/průvodce zmínky; seznam zbylých výskytů „Playmate“ jen tam, kde jde opravdu o Playboy | `grep` výskytů projde ručně s poznámkou |

#### Stránky Čísel ve stylu hero (0.02.023–0.02.025, přidáno 10. 11. 2026)

Kalendář, Obálky a Centerfoldy dostanou nahoře hero banner jako Profily, Statistiky a Síň slávy (velká fotka,
nadpis, pár čísel a akce; při rolování odjede nahoru) a pod ním širokou lištu ovládání místo řádku čipů. Volba
časopisu a edice zůstává v liště; hero ukazuje zvolený časopis.

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.023 ✅ | **Kalendář:** hero se zvoleným ročníkem a časopisem – obálka čísla, úplnost ročníku (kolik čísel má cover, centerfold a pictorial), „před N lety vyšlo“ a akce Další ročník / Doplnit chybějící | Kalendář Penthouse 1985 má hero s úplností ročníku |
| 0.02.024 ✅ | **Obálky:** hero s obálkou (výročí čísla dnes, jinak nejlépe hodnocená zvolené řady), počty obálek a chybějících, akce Otevřít číslo / Další | hero Obálek se střídá a respektuje časopis |
| 0.02.025 ✅ | **Centerfoldy:** hero s centerfoldem (výročí, jinak nejlépe hodnocený ve zvoleném časopise), jméno, titul podle časopisu („Pet of the Month“), srdíčka a akce Profil / Další | stěna Penthouse má v hero Pet of the Month |

#### Profil napříč časopisy a slučování modelek (0.02.026–0.02.034, dříve etapa 0.04)

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.026 ✅ | **Kariéra v profilu:** čísla a časová osa modelky barvou časopisu, souhrn „Pet of the Month 1985 · Playmate 1987“ | profil modelky ze dvou časopisů ukáže obě čísla |
| 0.02.027 ✅ | **Přezdívky:** víc jmen u modelky (jiné jméno v jiném časopise); rozhodnuto 10. 11. 2026: v poli Další jména jako „Jane Doe @PH“, bez úpravy schématu | přezdívka se uloží a je v exportu |
| 0.02.028 ✅ | **Hledání podle přezdívek** v hledání, našeptávači, `[[odkazech]]` a zásobníku odkazů | modelka se najde pod kterýmkoli jménem |
| 0.02.029 ✅ | **Kandidáti na sloučení:** úkol Údržby ze stejného jména / přezdívky a data narození | na vzorku žádný falešný kandidát se stejným jménem a jiným datem |
| 0.02.030 ✅ | **Vizuální podobnost v návrhu:** CLIP a otisky (PD 1.32–1.33) jako důvod a pořadí kandidátů | návrh ukáže důvody |
| 0.02.031 ✅ | **Odhad až po první galerii:** odhad srdíček jen u modelky s fotkami s analýzou obsahu nebo hodnocenými fotkami (přání uživatele) | modelka bez fotek nemá odhad (test) |
| 0.02.032 ✅ | **Vydání z importu podle alb:** textové vydání bez časopisu dostane časopis alba téhož čísla (nahlášená chyba) | Pet Penthouse nemá v profilu Playboy (test) |
| 0.02.033 ✅ | **Sloučení:** rozdíl nanečisto, převod alb, fotek, hodnocení a porovnání, Vrátit (PD 1.51.1); nikdy automaticky | sloučení a Vrátit vrátí obě modelky beze ztráty (test) |
| 0.02.034 ✅ | **Jednotné štítky profilu:** časopis a rok, role z galerií (titul, Pictorial, Online / Cyber Girl), profese z Role (přání uživatele) | Playboy i Penthouse modelka mají stejnou strukturu (test) |

#### Ladění: vykreslování, grafika a napojení (0.02.037–0.02.048, přidáno 11. 11. 2026)

Nové funkce stojí, dokud tahle část není hotová. Každý krok projde obrazovky na vzorových modelkách – Playboy
(Buffy Tyler), Penthouse (Ulla Lindstrom, Heide Mann), jen online (Ali Rose), víc časopisů a modelka bez fotek – a co
nesedí, opraví; nahlášené chyby z používání mají přednost před pořadím.

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.037 ✅ | **Kontrolní seznam po obrazovkách:** 213 neověřených bodů K-VYZKOUSENI projít – co jde, ověřit testem nebo snímkem, zbytek seskupit podle obrazovek do krátkého seznamu k proklikání | seznam do 40 bodů po obrazovkách, ověřené odškrtnuté |
| 0.02.038 ✅ | **Tituly všude z galerií:** kategorie ve filtrech, hledání `kategorie:`, kartách galerie, Statistikách a Údržbě stejně jako štítky profilu (0.02.034); z Role jen profese; titul i z prázdného centerfoldu a z názvu alba „… of the Month / Year“ | modelka s „PMOTM“ jen v Roli nemá titul nikde, titul z galerie má všude (test) |
| 0.02.039 ✅ | **Data do pořádku v Údržbě:** návrhy „doplnit číslo albu“ (z údajů modelky, 0.02.036), „titul jen v Roli → typ alba s titulem“ (jediný pictorial) a Vrátit po hromadném přijetí; „titul z Role pryč“ odpadá – tituly v Roli se od 0.02.038 nečtou, mazat je není třeba. Hromadně s rozdílem nanečisto a Vrátit | Heide Mann má po jednom potvrzení album 1970-10@PH |
| 0.02.040 ✅ | **Napojení odhadů srdíček:** proč modelka nemá odhad (nápověda štítku a Hodnocení), stav analýzy obsahu fotek, kolik modelek čeká na galerii | v Hodnocení je vidět, kolik modelek čeká na galerii nebo analýzu |
| 0.02.041 ✅ | **Profil:** hero, štítky, blok Časopisy, alba s číslem a časopisem, panel Údaje, časová osa | 5 vzorových modelek bez přetékajícího textu a prázdných míst (snímky 1280 a 1920 px) |
| 0.02.042 ✅ | **Galerie a karty modelek:** štítky a páska čísla podle časopisu, řazení, prázdné stavy, filtry | karta modelky Penthouse nikde neukáže Playboy |
| 0.02.043 ✅ | **Stránky Čísel:** Kalendář, Obálky, Centerfoldy, Mapa čísel a stránka čísla – hero (ořez 3:4, výročí, další), pro Playboy i Penthouse | hero ukáže správnou fotku a jméno pro obě řady |
| 0.02.044 ✅ | **Hodnocení a Síň slávy:** hero s filtrem časopisu (trůn), porovnání, štítky odhadu | filtr časopisu nikdy neukáže prázdný hero |
| 0.02.045 ✅ | **Údržba a Statistiky:** rozložení, texty a grafy s modelkami jiných časopisů | žádný graf ani úkol nepočítá Pet jako Playmate |
| 0.02.046 ✅ | **Stejná data ve všech pohledech:** tatáž modelka má stejné časopisy, tituly a čísla v profilu, kartě, hledání, kalendáři, stěně a statistikách | test na vzorové sbírce s Playboyem, Penthouse a Hustlerem |
| 0.02.047 ✅ | **Výkon vykreslování:** Mapa sbírky (výkonový test občas 500 ms), první vykreslení galerie a profilu, přepínání stránek | výkonové testy projdou 10× za sebou |
| 0.02.048 ✅ | **Prohlížeč PDF ve WebKitGTK** ověřit a doladit (worker, rychlost, vzhled) | 200stránkové číslo do 5 s |

#### Přehledná Sbírka (0.02.052–0.02.056, nahlášeno uživatelem 11. 11. 2026)

„Sekce Sbírka musí být přehlednější, provázanější.“ Dnes má dvě lišty (akce a stránky dohromady, pod nimi záložky
Údržby), mapa sekcí jmenuje části jinak než lišta (Souhrn × Dnes, Mapa čísel × Čísla a sháním, Učení v mapě chybí),
Čísla a sháním i Učení se otevírají jako boční panel přes Údržbu, hlavička počítá 1 135 úkolů a Dnes 2 661 (řádky
fronty × jednotlivé úkoly) a ukazatele Modelky / Alba / Čísla nikam nevedou.
**Rozhodnuto (11. 11. 2026):** čtyři stránky v jedné liště – **Přehled · Úkoly · Čísla a sháním · Učení**; režimy
úkolů (Po údajích, Po modelkách, Stejné fotky, Otočené a výřezy, Z webu) jako přepínač uvnitř Úkolů; akce (Přidat,
Importovat, Exportovat, Zkontrolovat soubory) v jednom tlačítku. Má přednost před zbytkem Chytrého výřezu; ten
a vše za ním posunuto o 5.

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.052 ✅ | **Jedna lišta:** záložky Přehled · Úkoly · Čísla a sháním · Učení z jednoho seznamu, ze kterého se kreslí i mapa sekcí a cesta Zpět; akce v tlačítku „Akce ▾“ | lišta, mapa i Zpět používají stejné názvy, nad obsahem je jediná lišta |
| 0.02.053 ✅ | **Celé stránky:** Čísla a sháním a Učení jako stránky místo bočního panelu přes Údržbu; Přehled = dnešní Dnes + ukazatele + Na pozadí | jeden posuvník, stránka si pamatuje, kde jsi byl |
| 0.02.054 ✅ | **Jedno počítání úkolů:** stejné číslo v hlavičce, liště, Přehledu a mapě (s vysvětlením řádek × úkol, kde je potřeba) | žádná dvě různá „úkoly“ na jedné obrazovce |
| 0.02.055 ✅ | **Proklik ukazatelů:** Modelky / Alba → Úkoly s filtrem oblasti, Čísla → Čísla a sháním, řádky Na pozadí → příslušný režim, buňka v mapě čísel → číslo a jeho úkoly | každé číslo na Přehledu vede tam, kde se dá vyřešit |
| 0.02.056 ✅ | **Propojení ven a zpět:** z profilu a čísla „N úkolů ve Sbírce“ s filtrem na ně, z úkolu odkaz na profil/číslo a návrat na stejné místo; snímky před a po | z profilu se jedním klikem dostaneš k jeho úkolům a zpět |

#### Chytrý výřez náhledů (0.02.049–0.02.058, nápad uživatele 11. 11. 2026)

Tlačítko **Automatický výřez** u titulní fotky (detektor postavy, `NavrhnoutVyrezy` v `otocene_fotky.go`) rozšířit na
všechny ořezané náhledy: dlaždice Galerie a řad kolekcí, mozaika alb v profilu, stěna Centerfoldů, hero pohledů,
karty Síně slávy a Porovnat. Dnes se ořezávají na střed (`object-fit: cover`), takže hlava nebo postava bývá useknutá.
Zařazeno před PDF (uživatel 11. 11. 2026); PDF a další kroky posunuté o 5, po přidání Explicitních fotek o další 3; kroky 0.02.052–053 (ruční výřez, kontrola) posunuté za Přehlednou Sbírku jako 0.02.057–058.

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.049 ✅ | **Výřez každé fotky:** rámeček postavy a obličeje z detektoru, počítaný v pozadí s obsahem fotek (`obsah/vyrezy.bin`), API pro rozhraní | výřezy 23 000 fotek se spočítají v pozadí bez sekání
| 0.02.050 ✅ | **Náhledy podle výřezu:** `object-position` z bodu zájmu u všech ořezaných náhledů (jedna pomocná funkce místo stylu v každém pohledu) | v Galerii a mozaice profilu není useknutá hlava |
| 0.02.051 ✅ | **Tvar podle místa:** na výšku, na šířku a čtverec – hero a široké řady posunou výřez jinak než úzká dlaždice | hero Kalendáře a Centerfoldů ukazuje postavu, ne pozadí |
| 0.02.057 ✅ | **[schéma] [export] Ruční výřez fotky:** tabulka výřezů podle souboru (bod zájmu a přiblížení), v exportu a importu; ruční výřez má přednost před automatickým | export a import zachová ruční výřez |
| 0.02.058 ✅ | **Úprava ručně a kontrola:** v prohlížeči fotek „Upravit výřez náhledu“ (táhnout bod zájmu), Údržba › Výřezy pro fotky, kde detektor nic nenašel; snímky pohledů před a po | ruční výřez se projeví ve všech pohledech, žádný náhled horší než střed |

#### Explicitní fotky zvlášť (0.02.059–0.02.063, přání uživatele 11. 11. 2026)

Galerie dnes míchá fotky všech časopisů: explicitnější fotky (Penthouse, Hustler) – sex s mužem a lesbické scény –
se objevují mezi pózovacími v řadách kolekcí, v heru i ve Všech fotkách. Mají mít vlastní kategorii.
**Rozhodnuto (11. 11. 2026):** zařazeno hned po chytrém výřezu (PDF a další kroky posunuté o 3); ve výchozím
stavu jsou takové fotky **jen ve vlastní řadě**, ne v běžných kolekcích, heru a Všech fotkách.
**Obrazový model (dotaz uživatele 11. 11. 2026):** dnešní detektor je malý NudeNet 320n (12 MB, vstup 320 px) –
na celé postavě v pózovací fotce stačí, ale muže nebo druhou ženu v záběru scény může přehlédnout. Krok
Rozpoznání proto nejdřív změří přesnost se stávajícími modely (detektor + popis scény z CLIP vektorů, které už
sbírka má – „pár při sexu“, „dvě ženy se líbají“, bez nového modelu). Když na vzorku nevyjde 9 z 10, vloží se za
něj krok **Větší detektor** (NudeNet 640m, ~4× pomalejší; partie a výřezy se jednou přepočítají v pozadí) a
další kroky se posunou.
**Změřeno (0.02.059, 11. 11. 2026):** vzorek 300 fotek (200 PH, 100 PB) roztříděný ručně: 3 sex, 13 dvě a víc žen,
5 sporných. Detektor (muž ≥ 0,5) najde sex 2 ze 3, ale lesbické nepozná vůbec – ukládá jen nejvyšší jistotu
obličeje, ne počet obličejů; nejvyšší „muže“ v celé sbírce jsou z velké části samotné ženy. Popis scény CLIP
(práh 0,7) sedí celkově u 96 %, jenže to dělají pózovací fotky: z 298 fotek „víc žen“ ve sbírce je na kontrolním
listu 50 kusů správně asi 42 (84 %), z 100 fotek „pár při sexu“ jen asi 17 z 50 s mužem. Sex tedy se stávajícími
modely 9 z 10 nesplní → vložen krok Větší detektor (0.02.060), další kroky posunuté o 1. Nástroj měření:
`internal/obsah/druh-mereni` (CSV jistot detektoru a podobností s popisy z `popisy.txt`).
**Změřeno a rozhodnuto (0.02.060, 11. 11. 2026):** NudeNet 640m (zrcadlo SimonJoz na Hugging Face, 104 MB) na
stejném vzorku: muže u kandidátů „sex“ najde u 3 ze 17 (320n u 1), ~5× pomalejší – nepomůže, nezapojuje se. Logistická
regrese nad vektory CLIP z ~390 ručně roztříděných fotek (5násobná křížová validace): „víc žen“ práh 0,85 najde 43
z 55 s 2 falešnými z 290, „muž na fotce“ 19 ze 42 se 7 falešnými z 348. **Uživatel zvolil:** program jen navrhuje,
fotky se přeřadí po potvrzení (krok 0.02.061), učení z potvrzení zpřesní odhad. Pozor: „muž na fotce“ zahrnuje
i oblečené scény ze zákulisí – potvrzení rozliší sex od fotky jen s mužem.

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.059 ✅ | **Rozpoznání – měření:** přesnost stávajícího detektoru a popisu scény CLIP na vzorku 300 fotek PH a PB (nástroj druh-mereni) | změřeno: lesbické CLIP ~84 %, sex jen ~35 % → Větší detektor |
| 0.02.060 ✅ | **Odhad druhu fotky:** větší detektor 640m změřen a zahozen (muže ve scénách nevidí, 5× pomalejší); místo něj odhad „muž na fotce“ a „víc žen“ naučený z ručně roztříděných fotek nad vektory CLIP (vestavěné váhy `druh.bin`); Údržba › Otočené a výřezy › Druh fotek ukáže návrhy s jistotou | návrhy na kontrolních listech sedí zhruba u 9 z 10 |
| 0.02.061 ✅ | **[schéma] [export] Potvrzení druhu:** tabulka druhů fotek (pózovací / lesbická / sex / jen s mužem, potvrzeno uživatelem); v Údržbě › Druh fotek potvrdit nebo opravit po jedné i označeným, v prohlížeči fotky „Druh fotky…“ | potvrzený druh vydrží restart, export a import |
| 0.02.062 ✅ | **Galerie zvlášť:** potvrzené sex a lesbické fotky (a odhady s jistotou ≥ 95 %) vypadnou z řad kolekcí, hera a Všech fotek; vlastní řada a kolekce „Páry a lesbické“, filtr k zapnutí | v běžných řadách není žádná potvrzená fotka se sexem |
| 0.02.063 ✅ | **Učení z potvrzení:** potvrzené a opravené fotky doladí odhad druhu (z vestavěných vah, s kotvou z vestavěného odhadu), „Sporné první“ v Údržbě | hotovo: 24 potvrzených „pózovací“ ubralo i 16 podobných návrhů, ostatní beze změny; ověření na tvých opravách v K-VYZKOUSENI |

#### Fotky z PDF (0.02.035–0.02.036, dříve etapa 0.05)

**Rozhodnuto (11. 11. 2026):** stránky z PDF se vyexportují jako obrázky do složky pro Google Disk a po nahrání
se spárují s odkazy; pravidlo „fotky jsou jen odkazy na Disk“ zůstává (žádný místní zdroj fotek).
**Přesunuto (12. 11. 2026, přání uživatele):** zbylé kroky (označit, přiřadit, uložit stránky, návrh rozdělení) jsou
v oddílu [Možné](#možné-bez-termínu); otevírání a listování PDF zůstává.

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.035 ✅ | **Otevřít PDF:** náhledy stránek (pdf.js v rozhraní, bez nové závislosti v Go), listování a lupa | 200stránkové číslo se otevře do 5 s |
| 0.02.036 ✅ | **Album bez čísla podle údajů modelky:** text vystoupení „Penthouse říjen 1970“ a textové vydání dají číslo s časopisem (nahlášená chyba) | Pet Penthouse bez čísla alba není Playmate (test) |

#### Údaje z webu pro další časopisy (0.02.064–0.02.067, dříve etapa 0.06)

**Zjištěno (12. 11. 2026):** seznam Hustler Honeys nemá žádná Wikipedie a Wikidata mají Honey jen u 3 modelek;
krok „Hustler Honeys“ zrušen, Honey se nabídne jen z Wikidat (0.02.065).

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.064 ✅ | **Penthouse Pets z Wikipedie:** Ročník podle Wikipedie i pro Penthouse US – anglická Wikipedie seznam nemá, bere se italský „Penthouse Pet“ (Pets měsíců 1969–2025 a Pet of the Year); jen na kliknutí, přidání s potvrzením | hotovo: ročník 1970 ukáže Ilse Hasek a Heide Mann ve sbírce a 10 dalších Pets k přidání |
| 0.02.065 ✅ | **Wikidata:** ocenění Pet of the Month, Pet of the Year a Honey (s datem) jako návrh „Tituly“ v Doplnit z webu i ve frontě Údržba › Z webu; přijetí založí prázdný centerfold čísla nebo album titulu roku, Vrátit je smaže | hotovo: Victoria Zdrok dostane návrh „Pet of the Month červen 2002, Pet of the Year 2004“ |
| 0.02.066 | **Zásobník odkazů:** rozpozná odkazy z webů časopisů a předvyplní časopis a číslo; obsah za přihlášením se nečte | odkaz Penthouse předvyplní časopis |
| 0.02.067 | **Úplnost čísla** (PD 1.38) pro další časopisy | úplnost Penthouse čísla |

#### Vkus, odhady a Statistiky napříč časopisy (0.02.068–0.02.073, dříve etapa 0.07)

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.068 | **Časopis jako vlastnost** v modelu vkusu a odhadu srdíček | odhad u modelky Penthouse má důvod s časopisem |
| 0.02.069 | **Podobné modelky a Objevit** napříč časopisy | Objevit nabídne i Penthouse |
| 0.02.070 | **Můj vkus v čase:** časopis mezi vlastnostmi | věta „víc ti teď sedí Penthouse“, pokud to data ukážou |
| 0.02.071 | **Filtr a barva časopisu** ve všech grafech Statistik | graf jde omezit na časopis |
| 0.02.072 | **Srovnání časopisů:** výška, období, styl (jako Porovnat období) | průkazný rozdíl se ukáže, pokud je |
| 0.02.073 | **Mapa sbírky** obarvená časopisem | barvy podle časopisu |

#### Mobilní prohlížeč a záloha na Google Disk (0.02.074–0.02.080, přání uživatele 12. 11. 2026)

**Cíl:** stránka modelek v telefonu s Androidem – hero banner nahoře a pod ním dlaždice modelek jako v hlavním
programu, jen ke čtení. Program na PC i telefon se přihlásí stejným účtem Google; PC nahraje na Google Disk zálohu
databáze a malý balíček pro telefon, telefon si ho stáhne. Fotky se v telefonu zobrazují stejně jako na PC
(sdílené odkazy a náhledy Disku).

**Jak (zjištěno 12. 11. 2026):** Android aplikace v Go napsat jde – `gomobile` (jádro v Go jako knihovna pro
Android), Fyne (celé rozhraní v Go) nebo Wails v3 (mobilní verze zatím alfa). Databáze používá čisté Go
(`modernc.org/sqlite`), takže jádro na telefonu poběží. Doporučení: tenká aplikace s WebView a stejným JS jako
hlavní program (hero a dlaždice budou vypadat stejně), přihlášení Google přes systémový účet telefonu; Fyne by
znamenalo nakreslit vzhled znovu. Rozsahy Google `drive.file` a `drive.appdata` (jen soubory programu, ne celý
Disk) nepotřebují ověření aplikace Googlem. Potřeba: vlastní projekt v Google Cloud s klientem OAuth (návod v kroku
074) a Android SDK pro sestavení APK.

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.074 | **Přihlášení Google v programu:** OAuth 2.0 se systémovým prohlížečem a návratem na `127.0.0.1`, rozsahy `drive.file` a `drive.appdata`, token s právy `0600`, odhlášení v Nastavení (dříve 1.08.001) | přihlášení vydrží restart |
| 0.02.075 | **Záloha na Google Disk:** denní záloha se nahraje i na Disk (posledních 7), obnovení ze zálohy na Disku | obnova na čistém programu ze zálohy z Disku |
| 0.02.076 | **Balíček pro telefon:** výtah sbírky (modelky, srdíčka, hero, dlaždice s výřezy, odkazy na náhledy; bez explicitních fotek) nahraný na Disk po záloze | balíček celé sbírky do 5 MB (test) |
| 0.02.077 | **Kostra Android aplikace [měření]:** sestavení APK (WebView + `gomobile`, porovnat s Fyne), velikost a start | APK se nainstaluje a otevře na telefonu |
| 0.02.078 | **Přihlášení v telefonu:** stejný účet Google, stažení balíčku, práce bez sítě z posledního stažení | po změně na PC telefon ukáže novou modelku |
| 0.02.079 | **Stránka modelek v telefonu:** hero banner nahoře, dlaždice modelek s výřezy a srdíčky, hledání jménem | snímek z telefonu odpovídá stránce modelek na PC |
| 0.02.080 | **Instalace a nové verze:** APK z vydání na GitHubu, telefon nabídne novou verzi | aktualizace bez odinstalace |

#### Dotažení a alfa (0.02.081–0.02.085+, dříve etapa 0.08)

| Verze | Krok | Hotovo, když |
|---|---|---|
| 0.02.081 | **Soubory databáze** `playboy.db` → `katalog.db` (a učení) s přesunem a zálohou | starší zálohy jdou dál obnovit |
| 0.02.082 | **Zbytky názvu:** klíče localStorage, název zálohy, kapesní katalog | `grep playboy` jen tam, kde jde o časopis |
| 0.02.083 | **Ikona programu** | nová ikona v nabídce a panelu |
| 0.02.084 | **Repozitář:** přejmenovat na GitHubu, README, `instalovat.sh` | kontrola nové verze funguje i po přejmenování |
| 0.02.085+ | **Alfa:** používání se dvěma časopisy, jen opravy nalezených chyb | 14 dní bez nové chyby → 1.00.000 |

---

## Plán po 1.0 (převzato z Playboy Database)

Nedokončená část plánu PD 1.54–PD 1.63, přečíslovaná. Kde se týká Playboye (Playmate, česká edice), při převzetí
zohlednit časopis z etapy U.

#### 1.01 – Prohlížení a časopis 2

**Cíl:** režim čtení (PD 1.41) a prohlížeč fotek použít na víc míst a lépe využít výřezy z PD 1.45.

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.01.001 | Časopis z čehokoli | Režim čtení pro ročník, chytrý výběr, sezónu a Síň slávy (pořadí jako stránky) přes `otevritStrany` jako Rok ve sbírce (PD 1.46) | M |
| 1.01.002 | Dvoustrany podle výřezů | Rozvržení stran podle návrhu výřezu (PD 1.45), aby postava nebyla pod textem; dvě fotky na šířku vedle sebe | S–M |
| 1.01.003 | Dvě fotky vedle sebe | V prohlížeči porovnání dvou fotek se sdílenou lupou a posunem; z prohlížeče „Nastavit jako titulní / profilovou“ rovnou s návrhem výřezu | M |
| 1.01.004 | Návrh titulní a profilové | Pro modelky bez nich návrh z vkusu, kvality (PD 1.51) a výřezu (PD 1.45) jako úkol Údržby | S |

**Hotovo, když:** jde promítat libovolný chytrý výběr jako časopis a modelky bez titulní fotky mají návrh na jeden klik.

---

### Etapa I – Sbírka výtisků (1.02–1.05)

Česká edice se sbírá fyzicky (Rozhodnuto: výtisky jen u CZ; po přechodu rozhodnout, jestli i u dalších časopisů, např. Penthouse v PDF ne). Dnes program ví jen „mám / sháním“; tato etapa doplní,
v jakém stavu výtisk je, kolik stál a co jde vyměnit, a končí tiskovými sestavami (PD 1.57, přesunuto z PD 1.43) a burzou; kapesní katalog (PD 1.47) pak ukáže i stav výtisku.

#### 1.02 – Evidence výtisků české edice **[schéma]**

**Cíl:** u každého čísla české edice zapsat stav a původ výtisku tak rychle, jako se dnes přepíná „mám / sháním“.

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.02.001 | Údaje výtisku | Stav (jako nový / velmi dobrý / dobrý / poškozený), chybí plakát nebo strany, počet kusů, cena, kde a kdy koupeno, poznámka; další volná úprava schématu (tabulka `vytisky` s klíčem vydání) a verze exportu (č. 17 a export 14 bere 0.02), převod ze sloupce `stav` beze ztráty | M |
| 1.02.002 | Rychlý zápis | V detailu čísla karta Výtisk, v Kalendáři klávesy pro stav; „Koupeno dnes za…“ jedním polem (cena a místo se pamatují z minula, našeptávač míst) | S–M |
| 1.02.003 | Hledání a filtry | Příkazy `vytisk:poškozený`, `cena:>200`, `koupeno:2026`, `kusu:>1`; čipy chytrého hledání (PD 1.36) a chytré výběry (PD 1.37) | S |

**Hotovo, když:** koupené číslo jde zapsat i se stavem a cenou do 10 s a hledání `vytisk:poškozený` najde výtisky k výměně za lepší.

#### 1.03 – Výdaje a hodnota sbírky

**Cíl:** vědět, kolik sbírka stála, kolik ještě bude stát a kde se nakupuje nejlépe.

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.03.001 | Karta Výtisky ve Statistikách | Utraceno celkem a po letech nákupu, průměrná cena čísla podle ročníku vydání, místa nákupu s průměrnou cenou, nejdražší kusy; křivky s rozpětím (PD 1.34) | S–M |
| 1.03.002 | Odhad do kompletu | Kolik čísel chybí a odhad ceny zbytku z průměrů daného období (medián, ne průměr; málo dat = rozpětí); u ročníku „do kompletu chybí 3 čísla, asi 450 Kč“ | S |

**Hotovo, když:** Statistiky ukážou výdaje po letech a u každého neúplného ročníku odhad, kolik stojí ho dokončit.

#### 1.04 – Rozšířené tiskové sestavy (katalog chybějících čísel a kapesní seznam; přesunuto z PD 1.43)

**Cíl:** vylepšit tiskové výstupy pro reálné použití v terénu (antikvariáty, burzy): kapesní seznam sháněných čísel na jednu stránku A4 a tiskový arch ročníku s obálkami.

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.04.001 | Kapesní seznam „Sháním“ na 1× A4 | Kompaktní vícesloupcový tiskový výstup všech chybějících a sháněných čísel CZ/US edice se zaškrtávacími políčky a poznámkou o Playmate měsíce | S |
| 1.04.002 | Tiskový přehled ročníku s obálkami | Přehledová stránka vybraného ročníku (12 obálek + Playmate měsíce + stav ve sbírce) optimalizovaná pro tisk do PDF | S |

**Hotovo, když:** z Časopisů nebo Mapy sbírky lze jedním klikem vytisknout kompaktní seznam sháněných čísel na jednu stránku.

#### 1.05 – Burza a výměny

**Cíl:** připravit se na burzu nebo inzerát jedním klikem: co nabízím (duplikáty, horší kusy) a co sháním.

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.05.001 | Nabízím / Sháním | Seznam duplikátů (kusů > 1) a výtisků k výměně za lepší stav, vedle sháněných čísel; text ke zkopírování do inzerátu (prostý text i markdown) | S |
| 1.05.002 | Tisk pro burzu | Rozšíření kapesního seznamu z PD 1.57 o sloupec „nabízím“ a cenový strop u sháněných čísel | S |

**Hotovo, když:** jedním klikem vznikne text inzerátu „Nabízím / Sháním“ a tiskový arch na burzu.

---

### Etapa J – Odložené: Kvíz, průvodce číslem, Google Disk a světlý motiv (1.06–1.10)

Na přání uživatele odložené na konec plánu (kvíz z PD 1.43, průvodce číslem z PD 1.36 a PD 1.38, Google Disk z PD 1.38–PD 1.39); vkládání z Disku stojí na prohlížeči Disku, proto jdou spolu.

#### 1.06 – Kvíz „Poznej modelku“ (odloženo z PD 1.43)

**Cíl:** odlehčená znalostní hra nad vlastní sbírkou přímo v aplikaci (statistiky a Leitnerovy krabičky uložené v `nastaveni`, bez změny schématu DB).

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.06.001 | Hra „Kdo je to?“ a „Který rok / číslo?“ | Titulní fotka nebo obálka a 4 možnosti (lehká = náhodné, těžká = podobné modelky ze stejného desetiletí), ovládání klávesami `1`–`4`, `Enter`, `Esc` | M |
| 1.06.002 | Skóre, série a opakování chyb | Evidence úspěšnosti a nejdelší série v `nastaveni`, po hře přehled chyb s proklikem na profil, častější zařazování modelek, které uživatel plete | S |

**Hotovo, když:** deset otázek lze odehrát čistě z klávesnice, po hře se zobrazí přehled chyb s proklikem na profily a statistiky přežijí restart.

#### 1.07 – Průvodce přidáním celého čísla (odloženo z PD 1.36 a PD 1.38)

**Cíl:** přidat celé číslo časopisu (obálka, Playmate měsíce, další modelky na obálce a v čísle, rozhovor, fotky) v jednom souvislém průvodci se živou kontrolou úplnosti a tlačítkem „Vrátit přidání“.

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.07.001 | Průvodce číslem | Kroky: 1. Základ a obálka → 2. Playmate měsíce (výběr existující nebo inline vytvoření nové) → 3. Další modelky a rozhovor → 4. Shrnutí s kontrolou úplnosti | M–L |
| 1.07.002 | Odhad dalšího chybějícího čísla | Tlačítko „+ Přidat další chybějící“ v Časopisech a v Mapě sbírky rovnou předvyplní nejbližší chybějící měsíc a rok | S |
| 1.07.003 | Cílené „Vrátit přidání“ | Po uložení průvodce lišta s možností vrátit celé právě přidané číslo (včetně nově vytvořených záznamů z tohoto kroku) | M |

**Hotovo, když:** celé číslo s obálkou, Playmate měsíce, rozhovorem a fotkami vznikne v jednom okně bez překlikávání a lze ho jedním klikem vrátit.

#### 1.08 – Google Disk v aplikaci (OAuth 2.0 + prohlížeč složek)

**Cíl:** volitelné přihlášení ke Google Disku (`golang.org/x/oauth2`, rozsah `drive.readonly` / `drive.file`) s prohlížením vlastní složky Playboy přímo v okně programu, bez nutnosti ručně kopírovat odkazy z prohlížeče. Návrh v [NAVRH-GOOGLE-DISK.md](docs/NAVRH-GOOGLE-DISK.md).

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.08.001 | Přihlášení a správa přístupu (přesunuto do 0.02.074) | OAuth 2.0 se systémovým prohlížečem a návratem na `127.0.0.1`, uložení tokenu s právy `0600`, kořenová složka a odhlášení v Nastavení | M |
| 1.08.002 | Prohlížeč složek a fotek | Strom složek, drobečková cesta, hledání složky, mřížka náhledů s indikací „už je v databázi“ | M |

**Hotovo, když:** přihlášený uživatel vidí své složky na Disku přímo v programu a pozná, které fotky už v databázi jsou.

#### 1.09 – Vkládání fotek a obálek přímo z Disku

**Cíl:** napojit prohlížeč Google Disku (PD 1.61) na zásobník fotek v detailu modelky, na obálku čísla a na hromadný import složky.

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.09.001 | Výběr pro modelku a obálku | Tlačítko „Vybrat z Disku…“ u fotek modelky, v průvodci číslem a u obálky; automatické předvyplnění hledání jménem modelky nebo číslem vydání | M |
| 1.09.002 | Chytré zařazení celé složky | Načtení složky s návrhem rozdělení (1. fotka = obálka / titulní, další = běžné fotky), přeskočení již evidovaných fotek | S–M |

**Hotovo, když:** fotky celé modelky nebo čísla lze vybrat z Disku v jednom okně bez kopírování URL adres.

#### 1.10 – Světlý motiv a kontrast (odloženo z PD 1.50, 10. 11. 2026)

**Cíl:** volitelný světlý motiv pro práci ve dne a vyšší kontrast, se stejným růžovým akcentem.

| Verze | Co | Jak | Prac. |
|---|---|---|---|
| 1.10.001 | Barvy jen přes proměnné | Převést ~740 natvrdo zapsaných barev ve `style.css` na proměnné (`--povrch-*`, `--text-*`, `--cara-*`, `--stin-*`); test, který hlídá, aby nové natvrdo zapsané barvy nepřibývaly | M–L |
| 1.10.002 | Světlý motiv | Tmavý (výchozí) / Světlý / Podle systému (`prefers-color-scheme`); růžový akcent s ověřeným kontrastem 4,5 : 1 na obou pozadích, zlaté prvky (`--zlato-*`) se pro světlé pozadí jen ztmaví; prohlížeč fotek, režim čtení a promítání zůstávají vždy tmavé | M |
| 1.10.003 | Vyšší kontrast | Silnější tlumený text, okraje a tlustší rámeček fokusu; navazuje na popisky pro čtečku (R18) | S |

**Hotovo, když:** všechny pohledy ve světlém motivu projdou kontrolou kontrastu WCAG AA a motiv se přepne bez restartu.

---

## Možné (bez termínu)

Nápady, které se udělají, až na ně přijde řada nebo chuť; nemají číslo verze.

| Krok | Co | Hotovo, když |
|---|---|---|
| PDF 1 | **Označit stránky PDF:** obálka, centerfold, stránky pictorialu; dvoustrana a rozkládací centerfold | označení vydrží zavření okna |
| PDF 2 | **Přiřadit:** označené stránky k modelce a albu čísla (existující nebo nová modelka) | číslo s Pet of the Month je v katalogu |
| PDF 3 | **Uložení stránek:** export do složky pro Google Disk a spárování odkazů po nahrání | fotky se zobrazí i po restartu |
| PDF 4 | **Návrh rozdělení:** kde začíná pictorial a kde je centerfold (rozložení stránky, obsah fotek PD 1.24) | návrh sedí na 3 zkušebních číslech |

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
  Od 12. 11. 2026 i pro přihlášení, zálohu na Disk a balíček pro telefon (0.02.074–0.02.080), jen rozsahy `drive.file` a `drive.appdata`.
- Malé náhledy smí program ukládat na disk jako mezipaměť (PD 1.6); originály a velké fotky zůstávají jen na Disku.
- 1.0.0 po 14 dnech používání alfy bez nové chyby (21. 10. 2026; místo bety alfa od 10. 11. 2026); po 1.0.0 MINOR pro téma z plánu, PATCH pro
  každý krok a opravu v tématu; MAJOR = velký milník, kompatibilitu dat hlídá verze schématu a exportu.
- Editor textů (PD 1.40): vlastní lišta nad markdownem s náhledem, žádná knihovna editoru.
- Wikidata, Wikipedie a Boobpedia (PD 1.38) jen na kliknutí a s potvrzením každého údaje; Babepedia ani jiné weby bez API se nečtou.

- **Přejmenování (10. 11. 2026):** Pinup Katalog; modelka je hlavní, časopis je údaj čísla vedle edice (země),
  výchozí Playboy; jedna modelka napříč časopisy = jeden profil (sloučení jen s potvrzením); verzování znovu od 0.1.0.

## Nedělat

- Obecné Zpět pro všechny úpravy (deník změn) – denní zálohy, Vrátit u fotek a Vrátit přidání čísla stačí.
- Místní kopie fotek v plné velikosti (malé náhledy jako mezipaměť ano, viz PD 1.6), zálohy na jiný místní disk (záloha na Google Disk ano, 0.02.075).
- Šifrovanou databázi – zvolen zámek rozhraní.
- Půlsrdíčka.
- Zobrazování fotek přes Google API s přihlášením (API jen k výběru fotek); automatický import celé
  složky bez výběru, automatické stahování a zápis údajů z webu bez potvrzení (Wikidata jen na kliknutí
  a s potvrzením každého údaje), rozpoznávání obličejů.
- Nové funkce v alfě a betě a neohlášené změny schématu nebo exportu (`TestZmrazeniAlfy`).
- Vše z oddílu „Rozhodnuto nedělat“ v `PLAN.md`.
