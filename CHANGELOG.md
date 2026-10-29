# Changelog

Všechny podstatné změny programu. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze mají tvar MAJOR.MINOR.PATCH (`x.xx.xx`, bez nul na začátku) podle oddílu „Pravidlo verzování“
v [ROADMAP.md](ROADMAP.md): MAJOR = milník, MINOR = téma z plánu, PATCH = krok nebo oprava. Starší milníky
(0.9.0, alfa 0.50.0) mají v repozitáři značky `vX.Y.Z`, nové se nedělají.

Verze 0.20–0.29 nebyly vydány: po 0.19.2 následovala rovnou 0.30.0 se změnou schématu i exportu.

## [0.99.83] – 2026-10-29

### Změněno
- **Kapsle voleb a filtrů vpravo nahoře:** volby přehledu (`#volbyPrehledu` – řazení, srdíčka, filtry, počet) se přesunuly z kontextové lišty do horního řádku okna na pravou stranu, oddělené od hlavních záložek (Modelky, Čísla, Centerfoldy, Oblíbenost, Sbírka) volným místem a svislou čarou před tlačítky okna. Kontextová lišta pod nimi drží jen drobečky, pilulky podčástí a akce (lupa, `+`, `⋯`).

## [0.99.82] – 2026-10-29

### Změněno
- **Celošířková vícesloupcová mřížka našeptávače a chytřejší globální hledání:**
  - Když našeptávač (`#naseptavac`) najde výsledky ve více skupinách (**Modelky**, **Čísla**, **Články**, **Fotografové**), rozloží je vedle sebe do sloupců přes celou šířku průsvitného pruhu (`#hledaniRadek`), s možností přecházet mezi sloupci šipkami `←` a `→`.
  - V našeptávači přibyla skupina **Fotografové** (otevře stránku fotografa) a doplňování hodnot filtrů (`ziskatMoznostiHodnot`) nově podporuje i příkazy `fotograf:`, `prsa:`, `misto:`, `etnicita:`, `ochlupeni:`, `narozena:`, `nafoceno:`, `vyska:`, `vaha:`, půlsrdíčka u `hodnoceni:` a vícenásobné hodnoty oddělené čárkou (`vlasy:blond,zrz`).
  - Vylepšeno řazení výsledků v našeptávači (přednost shody od začátku jména modelky či názvu čísla, prohledávání všech údajů modelky s mezipamětí `WeakMap` a automatickou invalidací `poZmeneDat`).
  - Otevření modelky, čísla, článku nebo fotografa z našeptávače automaticky skryje pruh hledání (`#hledaniRadek`), aby nezakrýval nově otevřenou stránku, a psaní do hledání na profilu či stránce čísla už nevytrhává uživatele po 180 ms pryč do galerie.

## [0.99.81] – 2026-10-29

### Změněno
- **Sjednocená průhlednost pruhu hledání a výsledků hledání v jednom pruhu:**
  - Pruh hledání (`#hledaniRadek`) pluje přímo přes horní okraj obsahu stránky (`position: absolute; top: 100%`), takže rozmazává obsah pod sebou se stejným průsvitným skleněným vzhledem jako nabídka výsledků hledání.
  - Kapsle vyhledávacího pole nemá vlastní tmavé neprůhledné pozadí (`var(--panel-bg)`), ale jemný skleněný povrch (`rgba(255, 255, 255, 0.05)`) sladěný s položkami výsledků.
  - Nabídka výsledků hledání (`#naseptavac`) se při psaní rozbaluje přímo uvnitř pruhu hledání jako jeho součást místo samostatného plovoucího boxu pod ním.

## [0.99.80] – 2026-10-29

### Změněno
- **Přepínač lupy v kontextové liště a průsvitný řádek s kapslí hledat uprostřed:**
  - Tlačítka přidání (`+`) a dalších akcí (`⋯`) jsou přesunuta do druhého řádku hlavičky (`.hlavni-lista`) na pravý okraj spolu s přepínačem lupy (`#searchToggleBtn`) ve stejném designu (`.nav-fav`).
  - Ve skrytém stavu má tlačítko lupy stejnou barvu jako `+` a `⋯`, v zobrazeném stavu svítí růžově (`var(--accent-text)`).
  - Kliknutí na lupu (nebo `Ctrl+F`) zobrazí a skryje třetí řádek (`#hledaniRadek`) se stejnou výškou jako řádek tlačítek, průsvitným skleněným pozadím jako kontextové nabídky a vyhledávací kapslí uprostřed.

## [0.99.79] – 2026-10-29

### Změněno
- **Rychlejší načítání, filtrování a vykreslování stránky Modelky:**
  - Při otevření galerie bez hledaného dotazu a při přepínání řazení nebo filtrů (srdíčka, edice, kategorie, výskyt) se modelky filtrují přímo z mezipaměti bez zbytečného volání backendu (`GetModelky`).
  - Četnosti kategorií a výskytu i odvozené údaje modelek pro filtrování se pamatují v mezipaměti a nepřepočítávají se při každém překreslení; zrušení všech filtrů proběhne v jednom kroku.
  - Značky částí (`data-cast`) pro rejstřík se vkládají rovnou do šablony karet bez druhého průchodu DOMem; nepřiblížené fotky (`coverZoom = 1`) nevytvářejí zbytečné kompozitní vrstvy (`transform: scale(1)`).
  - Uložení výřezu titulní fotky (`SetCoverVyrez`) aktualizuje zapamatovaný snímek sbírky v paměti přímo na místě bez znovunačítání všech tabulek z databáze.
- **Plynulejší posuvník, rejstřík a klávesové ovládání karet v galerii:**
  - Karty mimo obrazovku (`content-visibility: auto`) drží přesný poměr stran `3 / 4`, takže při rolování ani skoku přes rejstřík neposkakuje posuvník; rámeček zaměřené karty (`:focus-visible`) se neořezává.
  - Mezi kartami v mřížce lze přecházet šipkami `←`, `→`, `↑` a `↓` (včetně skoku o řádek nahoru a dolů ve stejném sloupci).
  - Hodnocení srdíčky na kartě při zapnutém filtru srdíček nepřekresluje celou galerii, dokud modelka filtr splňuje (karta neodskočí pod kurzorem a funguje dvojstisk číslice `1`–`5` pro půlsrdíčko).
  - V úzkém pravém rejstříku (`#galleryNav`) se popisky počtu fotek (`50+`, `20–49`, `1–19`) a srdíček (`4½ ♥`) zkracují bez přetékání a na kartě s dlouhým jménem zůstává šipka trendu vždy viditelná vedle zkráceného jména.

## [0.99.78] – 2026-10-29

### Změněno
- **Sjednocená dvouřádková hlavička a pět hlavních záložek (Varianta A + B):**
  - **Horní řádek (`.titulek-okna`):** pět hlavních záložek pohromadě vlevo (**Modelky**, **Čísla**, **Centerfoldy**, **Oblíbenost**, **Sbírka**, zkratky `Ctrl+1` až `Ctrl+5`), vpravo tlačítka akcí (`+`, `⋯`) a tlačítka okna (`–`, `□`, `×`).
  - **Druhý řádek (`.hlavni-lista`):** kontextová lišta otevřené sekce – vlevo návrat a drobečky na podstránkách (`.logo`), přepínač podčástí (`#pasStranky`) a volby přehledu, filtry a počty (`#volbyPrehledu`), vpravo vyhledávací pole (`.nav-controls`).
  - **Oblíbenost na jednom místě:** dřívější záložky *Nejlepší*, *Hodnocení* a *Síň slávy* jsou sjednocené pod záložkou **Oblíbenost** s pilulkami **Porovnat**, **Fotky**, **Pořadí**, **Síň slávy** a **Nejlepší** v kontextové liště; pohledy Síně slávy (*Top 10*, *Legendy*, *Odznaky*, *Rekordy*, *Kronika*) se přepínají přímo ve volbách lišty bez třetího plovoucího pásu v obsahu stránky.
  - **Sbírka bez plovoucího pásu v obsahu:** podčásti **Úvod**, **Údržba**, **Sháním CZ** a **Statistiky** i jejich stav a akce (*Kopírovat seznam*) jsou přímo v kontextové liště pod záložkami.

## [0.99.77] – 2026-10-29

### Opraveno
- **Tlačítka okna (minimalizovat, maximalizovat, zavřít)** v pravém horním rohu hlavičky jsou zase vidět: po omezení šířky drobečků vlevo (`.logo`) v 0.99.75 chybělo u `.window-controls` zarovnání doprava (`margin-left: auto`), takže se tlačítka posunula doprostřed pod pole hledání.
- V nejužším okně (do 420 px, kde je hledání skryté) využijí drobečky celou šířku až k tlačítkům okna a zamčená obrazovka lícuje se spodní hranou řádku okna (40 px).

## [0.99.76] – 2026-10-29

### Změněno
- **Statistiky ovládáš pod hledáním**, jako ostatní přehledy:
  - **Graf ▾** vybere graf;
  - ve Filtrech jsou Výskyt a Edice;
  - výběr z grafu je zapnutý filtr, který × zruší;
  - na konci je souhrn („22 modelek · 1971–1995“).
- **Údržba › Souhrn:** řazení fronty (⇅ podle priority ▾) a filtr **Vyřízené** jsou pod hledáním vedle režimů.
  - Vlastní pole hledání v Údržbě zmizelo, ve frontě hledá **hlavní hledání nahoře** („Hledat ve frontě Údržby…“).
  - ↓ nebo Enter z hledání skočí do fronty, Esc hledání zruší, do hledání vedou Ctrl+F i /.
- **Stránka fotografa:** filtr Vše / Centerfoldy / Pictorialy a alba je pod hledáním s počty, na konci je počet alb.
- **Zpět vede přesně tam, odkud jsi odešel**, i na konkrétní část. Jmenuje se podle ní („← Údržba“, „← Statistiky“, „← Sháním CZ“). U Hodnocení a Síně slávy nese název stránky.
- **Jednotné prázdné stavy:**
  - prázdná Top 10, Legendy, Sháním CZ, Statistiky bez modelek a dokončená fronta Po modelkách mají stejný vzhled s ikonou;
  - drobná hlášení uvnitř karet mají jeden společný styl.

### Opraveno
- V úzkém okně se lišta přizpůsobí při každé změně šířky a po načtení písma. Rejstřík u pravého okraje začíná pod skutečnou spodní hranou hlavičky a nezasahuje do lišty, když se zalomí.

## [0.99.75] – 2026-10-29

### Změněno
- **Nová horní lišta.** Vlevo jsou přehledy **Modelky · Čísla · Centerfoldy · Nejlepší**, vpravo stránky **Hodnocení · Síň slávy · Sbírka** (dřív „Přehled sbírky“), všechny jako záložky s ikonou a názvem. Za čárou zůstávají + a ⋯.
  - Klávesy **Ctrl+1 až Ctrl+7** otevřou záložky zleva doprava, fungují i na české klávesnici.
  - V užším okně mají nezvolené záložky jen ikonu (název ukáže bublina), zvolená má název vždy. Zkratky „Mod / Čís / Cf“ zmizely.
  - Klik na už zvolenou záložku jen vrátí stránku nahoru.
- **Pod hledáním jsou jen volby zobrazení a filtry** otevřené části: řazení a filtry přehledů, Obálky / Kalendář, ve Fotkách Náhodně / Po modelkách, v Pořadí Top 10 / Celé pořadí, v Kronice filtr událostí a v Údržbě režim Po údajích / Po modelkách / Souhrn. Na konci je počet („24 událostí“, „8 rekordů“).
- **Plovoucí pás stránek.** Hodnocení, Síň slávy a Sbírka mají nahoře v obsahu jeden společný pás: vlevo pilulky částí, vpravo stav stránky. Při rolování drží nahoře a zůstanou na něm jen pilulky.
  - Číslo v pilulce je jen to, co čeká na tebe (k porovnání, nehodnocené fotky, úkoly Údržby, sháněná čísla).
  - Síň slávy má v pilulkách ikony místo emoji.
  - Ve Sbírce je první část **Úvod** (dřív Přehled). Místo nadpisů „ÚDRŽBA“, „SHÁNÍM CZ“ a „STATISTIKY SBÍRKY“ je stav vpravo v pásu („79 % doplněno · 29 úkolů“, „Kopírovat seznam“).
  - Šipky ← → přepínají pilulky pásu i volby pod hledáním.
- **Hledání funguje i na stránkách Hodnocení, Síň slávy a Sbírka** („Najít modelku…“). Najde modelku, číslo nebo článek a Enter otevře první výsledek, i když ho zmáčkneš hned po napsání.
- **Cesta zpět v profilu a čísle:** vlevo nahoře je „← Hodnocení › Dana Nováková ‹ 3 z 10 ›“.
  - Šipky ‹ › listují seznamem, ze kterého jsi profil otevřel: galerií, pořadím nebo Top 10.
  - Z hledání nebo kroniky šipky nejsou.
- Nejlepší mají rejstřík hodnot u pravého okraje jako ostatní přehledy. Hodnocení ukazuje „Dnes 0 z 10“. V odkazech je všude „Porovnat →“.

### Opraveno
- Lišta nástrojů a levý sloupec Údržby se při rolování drží nahoře (pod pásem), jak měly.
- Přepnutí mezi Hodnocením a Síní slávy už nenačítá oblíbenost dvakrát.
- Po Ctrl+číslo nezůstanou pod hledáním staré výsledky.
- Odkaz „Porovnat a Pořadí →“ na úvodu Sbírky vždy otevře Hodnocení.
- Fokus se po volbě v liště neztratí a zaměřený prvek se neschová pod pás.
- Z čísla zmizela nepoužívaná lišta.

## [0.99.74] – 2026-10-29

### Změněno
- **Porovnávání, Galerie a Pořadí jsou sloučené do jedné části „Hodnocení“** se stejným vzhledem jako síň slávy. V liště Oblíbenosti zůstávají jen Hodnocení a Síň slávy.
  - Nahoře jsou pilulky **Porovnat · Fotky · Pořadí** s počty (čekající na potvrzení, nehodnocené fotky, nesoulady). Vpravo je „Dnes N“ s pruhem k příští desítce porovnání a odkazy na to, co čeká jinde („3 čekají na potvrzení → Porovnávat“).
  - **Porovnat:** vedle důvodu dvojice je pruh **Dvojice v pořadí**. Ukazuje místa obou modelek a jejich sousedek s úrovní a po přepočtu posun ▲▼. Klávesy a souboje fungují jako dřív.
  - **Fotky:** dlaždice s pěti velkými náhledy, velkými čísly (nehodnocené fotky, modelky) a tlačítky Prohlížet a hodnotit a ▶ Promítat. Nově jde prohlížet jen fotky jedné modelky. Pod dlaždicí je dalších 16 fotek fronty.
  - **Pořadí:** nahoře karta **Čeká na rozhodnutí** se souboji o úroveň (⚔ Rozhodnout teď) a nesoulady se srdíčky (Dát jí, Nechat, Ověřit). Pod ní je kompaktní Top 10 a „Celé pořadí s úrovněmi“ k rozbalení, vedle Stoupají a klesají s fotkami a Mohlo by se ti líbit.

## [0.99.73] – 2026-10-29

### Změněno
- **Nová síň slávy.** Nahoře jsou pilulky Top 10 · Legendy · Odznaky · Rekordy · Kronika (s počty). Každý pohled má vlastní stránku, nic se nehromadí pod sebou. Zvolený pohled si program pamatuje a vpravo v liště je poslední událost kroniky.
  - **Top 10:** stupně vítězů a místa 4–10. Klik na kartu rozbalí pod řadou **vitrínu modelky**: čísla, odznaky se stupni a postupem, co jí ještě chybí, její rekordy a kronika. Zavře ji ✕ nebo Esc, „Profil →“ otevře profil.
  - Pod Top 10 je řádek **Na dosah**: pět nejbližších dalších stupňů odznaků. Klik na položku otevře vitrínu.
  - **Odznaky** jako sbírka medailí: souhrn nahoře a karta pro každý odznak se stupni, fotkami držitelek a tím, kdo má nejblíž dalšímu stupni. Nezískané jsou zašedlé se zámkem. Dlouhý výpis odznaků dole zmizel.
  - **Rekordy** stojí jako poháry na polici, pod nimi jsou Rekordmanky. **Kronika** je časová osa s filtrem (vstupy a pády, jedničky, obhajoby, odznaky).
  - Řada odznaků v profilu otevře síň slávy rovnou na Odznacích.

## [0.99.72] – 2026-10-29

### Přidáno
- **Pictorialy Playmate of the Month a Playmate of the Year.** V okně alba je u Časopisu nově druh Pictorial, Playmate of the Month, Playmate of the Year a Centerfold (jako Cyber Girl of the Week / of the Month u online alb).
  - Pictorial Playmate of the Month dá modelce kategorii Playmate měsíce, i když centerfold ve sbírce nemá.
  - Pictorial Playmate of the Year dá kategorii **Playmate roku s rokem čísla**, ve kterém vyšel (bez čísla rok z názvu alba). Platí v kartách, filtrech, hledání `kategorie:` i v modelu vkusu.
  - Zapsaná kategorie Playmate roku má přednost. Návrh „Playmate roku z poznámky“ se u modelky s takovým pictorialem už nenabízí.
  - Údržba (Další návrhy) navrhne druh i u stávajících pictorialů. Podle názvu alba („Playmate of the Year 1998“, „PMOY“, „Playmate of the Month“) nebo když jde o jediný pictorial v čísle jejího centerfoldu (Playmate of the Month).

## [0.99.71] – 2026-10-28

### Změněno
- **Rekordy (🏆) mají stejnou bublinu jako odznaky.** Po najetí myší na trofej na kartě v síni slávy se ukáže, co rekord měří, kdo ho drží a s jakou hodnotou a jestli pořád roste. U rekordů, kde to dává smysl, je i datum (začátek vlády, vstup do Top 10, návrat, série, skok). Když pobyt začal před kronikou, bublina upozorní, že skutečná hodnota může být vyšší.
- Stupeň v bublině odznaku začíná velkým písmenem jen na začátku („Bronz · stříbro · zlato“).

## [0.99.70] – 2026-10-28

### Opraveno
- **Méně volného místa nahoře v Oblíbenosti i Přehledu.** Porovnávání, Galerie, Pořadí, Síň slávy a ostatní části Přehledu měly pod lištou o 20 px víc volna než zbytek programu. Mezeru dělalo prázdné místo pro volbu části, která je v liště. Obsah teď začíná stejně vysoko jako jinde.

## [0.99.69] – 2026-10-28

### Změněno
- **Bublina odznaků vypadá jako kontextové nabídky a hledání.** Má průsvitné sklo s rozmazáním, stejný okraj, zaoblení a stín. Nad stupni je růžový nadpis „Stupně“ s linkou jako nadpisy skupin v nabídkách.

## [0.99.68] – 2026-10-28

### Změněno
- **Lepší bublina u odznaků.** Po najetí myší na odznak (na kartě v síni slávy, v profilu, v oddílu Odznaky i v „Na dosah“) se ukáže vlastní bublina.
  - Obsahuje ikonu, název a stupeň a popis, co odznak měří a kolik má modelka.
  - Ukazuje všechny stupně s prahy (dosažené zaškrtnuté), ukazatel postupu („ještě 8 dní do stříbra“), soupeřku a datum zisku.
  - Funguje i na kartách v síni slávy, kde dřív přes odznaky vyskakovala jen bublina celé karty.

## [0.99.67] – 2026-10-28

### Změněno
- **Oblíbenost › Hodnocení je teď Galerie nehodnocených fotek.**
  - Panel ukáže, kolik nehodnocených fotek a modelek zbývá, a nabídne „Prohlížet a hodnotit“ a „▶ Promítat“. Pořadí je buď náhodně napříč modelkami, nebo po modelkách.
  - Fotky se otevřou v běžném prohlížeči. Když fotka dostane srdíčka (1–5 nebo klik), zmizí a hned se ukáže další. Hodnocené se v Galerii neobjevují.
  - Prohlížení v Galerii se nepočítá jako zájem o modelku.
  - Dosavadní rychlé hodnocení modelek jedna po druhé zmizelo, s ním i odkazy „Projít v Hodnocení“ a „Ohodnotit rychle“ v Pořadí.

## [0.99.66] – 2026-10-28

### Přidáno
- **Odznaky v síni slávy.** Osobní úspěchy modelek, které může mít víc modelek naráz.
  - Se stupni bronz / stříbro / zlato: 🏛 Stálice (30 / 100 / 365 dní v Top 10), ♛ Královna (7 / 30 / 100 dní na 1. místě), 🛡 Hradba (3 / 5 / 10 obhajob), 🔥 Série (5 / 10 / 20 výher za sebou) a ⚔ Zasloužená (25 / 50 / 100 porovnání).
  - Jednorázové: 🚀 Raketa (do Top 10 z místa za stovkou do 30 dní), 🔄 Comeback (návrat po aspoň 30 dnech), 🪨 David a Goliáš (z místa za Top 20 porazila jedničku), ⬆ Přeskočená laťka (porazila modelku s o celé srdíčko víc) a 🧊 Neporazitelná (30 dní v Top 10 bez prohry).
  - Na kartě je řada medailonů pod jménem a barva kroužku ukazuje stupeň. V profilu jsou pod pořadím a klik otevře Síň slávy.
  - Nový oddíl Odznaky ukazuje, kdo co má, a v „Na dosah“ kolik komu chybí k dalšímu stupni.
  - Zisk odznaku se zapíše do kroniky. Odznaky se dopočítají i zpětně z dosavadních porovnání a kroniky.
- **Nové rekordy:** nejdelší série výher, nejvíc porovnání a největší skok v pořadí za týden.

## [0.99.65] – 2026-10-28

### Opraveno
- **Síň slávy: kronika už nezačíná znovu a dny sedí.**
  - Vrácení porovnání (Backspace) mohlo smazat začátek kroniky, když kronika začala až po tom porovnání. Kronika pak začala znovu a všechny modelky v Top 10 byly „od dneška“. Začátek kroniky už vrácení nesmaže.
  - Dny v Top 10 a na 1. místě se počítají podle kalendáře. Modelka, která se dostala na 1. místo včera večer, má dnes ráno 1 den, ne „od dneška“.
  - Kdo byl v Top 10 už na začátku kroniky, má pobyt dopočítaný z denních snímků pořadí. Ukáže se tedy „aspoň 8 dní“ od dne, kdy se do Top 10 opravdu dostala, místo dne, kdy kronika začala. Stejně se dopočítá vláda jedničky.

## [0.99.64] – 2026-10-28

### Opraveno
- **Zájem o modelky se počítá poctivěji.**
  - Prohlížení fotek otevřené z Porovnávání nebo Rychlého hodnocení se už nepočítá jako zájem. Ty fotky ti ukázal program, takže modelky, které často páruje, už nesbírají zájem jen proto.
  - Kolik zájem v pořadí váží, se program učí z porovnání. Teď u každého porovnání bere jen zájem z doby před ním. Dřív bral i pozdější prohlížení, takže zájem vypadal užitečnější, než je, a mohl dostat vyšší váhu.
  - Pořadí uvnitř srdíček se tím může mírně posunout.

## [0.99.63] – 2026-10-28

### Změněno
- **Srdíčka fotek už neposouvají sílu modelky.**
  - Srdíčka fotky říkají, jak dobrá je fotka té modelky, ne jak moc se ti líbí modelka. Pětisrdíčková fotka jedničkové modelky ji proto už nevytáhne nad čtyřku.
  - Pořadí v Oblíbenosti dávají srdíčka modelky, porovnání a zájem. Bez porovnání je oblíbenost přesně srdíčka.
  - „Nesedí se srdíčky“ navrhuje změnu jen podle porovnání, ne podle fotek.
  - Nehodnocené modelky jen s hodnocenými fotkami už nejsou v Pořadí jako „odhad z fotek“. Odhad dává jen model vkusu.
  - Skóre fotek („fotky 4,3“) zůstává jako údaj u modelky a model vkusu z něj dál odhaduje hodnocení.
  - Pod Pořadím zmizela věta o naučené váze fotek.

## [0.99.62] – 2026-10-28

### Změněno
- **Hodnota fotky se odvíjí od srdíček modelky.**
  - Srdíčka fotky říkají, jak dobrá je fotka té modelky. Pro řazení fotek různých modelek se proto násobí oblíbeností modelky: hodnota = srdíčka fotky × srdíčka modelky ÷ 5.
  - Pětisrdíčková fotka pětkové modelky má hodnotu 5, pětisrdíčková fotka jedničkové jen 1.
  - Platí v Nejlepších fotkách, které mají oddíly po hodnotě („hodnota ♥♥♥♥♥“), i na stěně při řazení podle srdíček.
  - Filtr ♥ 3+ / 4+ / 5 dál vybírá podle srdíček fotky.

## [0.99.61] – 2026-10-28

### Změněno
- **Porovnávání si pamatuje tvoje rozhodnutí.**
  - Dvojice, ve které sis jednu vybral, se měsíc od posledního porovnání nenabídne znovu.
  - Remíza nebo vyrovnaný stav (každá jednou vyhrála) se vrátí jako rozstřel nejdřív za týden.
  - Dřív se dvojice mohla vrátit už po 200 dalších porovnáních. Kdyby v menší sbírce došly dvojice, nabídnou se ty starší než týden.

## [0.99.60] – 2026-10-28

### Opraveno
- **Porovnávání už nehází pořád tytéž modelky.**
  - Modelka z posledních porovnání nebo z dvojic, které právě čekají ve frontě, chvíli nedostane souboj ani ověření srdíček, ani jako soupeřka. Výjimkou je souboj o obhajobu.
  - Modelku, které nesedí srdíčka, program ověřuje jen do 10 porovnání se stranou nesouladu. Pak už důkazy má a návrh srdíček zůstává na tobě. Dřív ji nabízel v každé dávce.
  - „Rozhodnout teď“ a „Ověřit porovnáním“ vynechají nedávno porovnané dvojice a nezopakují dvojici, která už čeká ve frontě.
  - V simulaci klesl nejčastější výskyt jedné modelky z 84 na 27 dvojic na 1500 porovnání a přesnost pořadí se nezhoršila.

## [0.99.59] – 2026-10-27

### Změněno
- **Porovnávání je přehlednější.**
  - **Hlavička nad pásy:** vlevo proč tahle dvojice, u souboje nebo ověření se štítkem („⚔ O postup do Top 10“, „⚔ Ověření srdíček“). Vpravo „Nesedí se srdíčky“ a dnešní počet porovnání.
  - **Pod pásy jen tři tlačítka:** Vrátit, Obě stejně, Přeskočit. Přehled kláves ukáže „⌨ Klávesy“ po najetí myší.
- **Fotky v pásech mají pevnou výšku a šířku podle fotky:** fotka na šířku je širší, nic se neořízne. Platí v Porovnávání i v rychlém hodnocení.
- **Alba v profilu modelky jako mozaika:** řádky stejné výšky, šířka dlaždice podle poměru stran fotky. Dlouhé album zůstává sbalené na dva řádky. Poměry stran si program pamatuje, takže řádky při dalším otevření neposkakují.

## [0.99.58] – 2026-10-27

### Přidáno
- **Ověření srdíček porovnáním:** modelka, které nesedí srdíčka, dostává v Porovnávání cíleně soupeřky z úrovně, kam podle nesouladu patří. Podhodnocená trojka jde proti 3½ a čtyřkám, nadhodnocená proti 2½ a dvojkám. Nad pásy je štítek „⚔ Ověření srdíček“.
  - U nesouladu v Pořadí i v Hodnocení je „⚔ Ověřit porovnáním“. Spustí čtyři taková porovnání hned za sebou s ukazatelem postupu.
  - Na konci pruh řekne, jestli porovnání nesoulad potvrdila („patří jí spíš 3½ ♥ místo 3 ♥“ s tlačítkem „Dát jí 3½ ♥“), nebo ne („3 ♥ jí sedí“).

## [0.99.57] – 2026-10-27

### Změněno
- **Rychlé hodnocení je chytřejší a sjednocené.**
  - **Nově přidané napřed:** nehodnocená modelka přidaná v posledních 14 dnech jde na začátek fronty.
  - **Pořadí podle užitku:** napřed modelky, u kterých tvoje srdíčka pořadí nejvíc změní, tedy vysoký, ale nejistý odhad. Odhad bere i sílu z porovnání a srdíčka fotek, nejen model vkusu.
  - **Nesedí se srdíčky ve frontě:** po nehodnocených přijdou modelky, kterým podle porovnání nesedí srdíčka, se stejným návrhem jako v Pořadí. Enter dá návrh, N srdíčka nechá. V Pořadí je odkaz „Projít v Hodnocení →“.
  - **Paměť přeskočených:** přeskočené modelky jdou na konec fronty i příště, ohodnocením z paměti zmizí.
  - **Ochrana před ukotvením:** nejistý odhad se ukáže až po chvíli (nebo po „Ukázat odhad“), aby nejdřív rozhodly fotky. Srdíčka daná Enterem z odhadu si program pamatuje jako převzatá a model vkusu se z nich neučí, dokud je nepotvrdí porovnání.
- **Model vkusu se učí i z porovnání:** nehodnocená modelka, která má za sebou aspoň tři porovnání a jistou sílu, mu slouží jako další příklad. Odhady se tak zlepšují i z porovnávání.

## [0.99.56] – 2026-10-27

### Přidáno
- **Rychlé hodnocení:** nová část Oblíbenosti „Hodnocení“ vedle Porovnávání. Ukazuje nehodnocené modelky jednu po druhé, vlevo velkou titulní fotku a vpravo pás jejích nejlepších fotek. Pod tím je odhad srdíček podle tvého vkusu i s důvodem.
  - **Klávesy:** Enter odhad přijme, 1–5 dá srdíčka (i na české klávesnici bez Shiftu), půlky jdou klikem na srdíčka. S přeskočí, Backspace vrátí poslední.
  - **Pořadí fronty:** napřed modelky, které by se ti podle odhadu mohly líbit nejvíc, pak ostatní. Po každých pěti hodnoceních se odhady zpřesní.
  - Odkaz „Ohodnotit rychle →“ je i u „Mohlo by se ti líbit“ v Pořadí.

## [0.99.55] – 2026-10-27

### Změněno
- **Rozhodnout teď je hned za štítkem pod jménem.** Růžový odkaz „⚔ Rozhodnout teď“ stojí na stejném řádku jako „⏳ čeká na Top 10 …“ nebo „🛡 obhajuje Top 10“, tedy u toho, co modelce chybí. Pruh síly vpravo zůstává volný a podbarvení čekající modelky zabírá celý její řádek.

## [0.99.54] – 2026-10-27

### Přidáno
- **Rozhodnout teď:** u čekající nebo obhajující modelky v Pořadí je tlačítko „⚔ Rozhodnout teď“.
  - Spustí hned za sebou jen ty souboje, které jí chybí: tolik, kolik jí chybí porovnání (2–6), proti posledním potvrzeným v úrovni. U obhajoby je to jediný souboj držitelky s vyzyvatelkou.
  - Nad pásy je pruh s ukazatelem postupu („souboj 2 ze 4“). Přeskočit a Vrátit fungují, Ukončit vrátí běžný mix.
  - Po posledním souboji se pořadí přepočte a pruh řekne, jak to dopadlo: postoupila, zatím nepostoupila (a co chybí), obhájila, nebo vypadla.

## [0.99.53] – 2026-10-27

### Změněno
- **Síň slávy: legendy vyplní celou šířku.** Nejvýš 7 v řadě, řady se plní rovnoměrně (8 legend → 4 + 4, 10 → 5 + 5), takže vpravo nezůstávají prázdná místa. Malé písmo jmen mají jen husté řady od šesti karet.

## [0.99.52] – 2026-10-27

### Změněno
- **Síň slávy: místa 4–10 v jedné řadě.** Sedm karet pod stupni vítězů se poměrně zmenší a vyplní celou šířku, vpravo nezůstane prázdné místo. V úzkém okně jdou po čtyřech.

## [0.99.51] – 2026-10-27

### Změněno
- **Profil modelky ukazuje pod srdíčky jen aktuální pořadí** („1. v oblíbenosti“, klik otevře Pořadí). Úroveň Top N, čekání, obhajoba, trend a řádek síně slávy z profilu zmizely; najdeš je v Oblíbenosti (Pořadí a Síň slávy).

## [0.99.50] – 2026-10-27

### Změněno
- **Síň slávy: stupně vítězů.** První tři modelky Top 10 mají větší portréty na stupních: 2. vlevo, 1. uprostřed a nejvýš, 3. vpravo. Každá stojí na podstavci s číslem místa, jednička v růžové, dvojka stříbrná, trojka bronzová. Od 4. místa zůstává běžná mřížka karet.

## [0.99.49] – 2026-10-27

### Přidáno
- **Síň slávy:** třetí část Oblíbenosti vedle Porovnávání a Pořadí.
  - **Top 10 jako karty modelek** jako v galerii. Vpravo nahoře je místo (jednička s korunkou), pod jménem jak dlouho v Top 10 je, kolikrát obhájila (🛡) a kolikátý je to pobyt. Podrobnosti ukáže bublina.
  - **Rekordy jako zlaté štítky 🏆 na kartě:** nejdéle v Top 10, nejdelší vláda na 1. místě, nejvíc obhajob, nejrychlejší postup a největší návrat.
  - **Legendy:** bývalé Top 10 jako vybledlé karty s nejlepším místem.
  - **Kronika** je jeden řádek s nejnovější událostí, po rozkliknutí celá po měsících. Obsahuje vstupy, výpadky (i kdo modelku vytlačila), obhajoby a nové jedničky.
  - **Profil** modelky, která v Top 10 je nebo byla, má řádek „🏆 V Top 10 87 dní · na 1. místě 12 dní · 2× obhájila · nejlépe 1.“, klik otevře Síň slávy.
  - Kronika se ukládá trvale a začíná touto verzí; kdo už v Top 10 je, má „aspoň“ dní od jejího začátku. Vrácení porovnání vrátí i kroniku.

## [0.99.48] – 2026-10-27

### Přidáno
- **Obhajoba místa v Top 10, 20 a 50: sestup je stejně těžký jako postup.**
  - Potvrzená modelka o místo nepřijde jen proto, že ji silou předstihla jiná. Drží ho, dokud s ní vyzyvatelka neprohraje ve vzájemném souboji; remíza se nepočítá.
  - Bez souboje místo ztratí, jen když přestane splňovat prahy úrovně nebo silou klesne pod dvojnásobek hranice (u Top 10 pod 20. místo).
  - Porovnávání nabízí souboj o obhajobu přednostně, se štítkem „Obhajoba Top 10“. Po souboji přijde upozornění „Bára obhájila Top 10“ nebo „… prohrála souboj a vypadla z Top 10“.
  - Pořadí ukazuje „🛡 obhajuje Top 10“ a „⚔ čeká na souboj o Top 10 (místo brání …)“, profil „Top 10 · 🛡 obhajuje“.
  - Vrácení porovnání vrátí i obhajobu.
  - V simulaci vypadávají z potvrzené Top 10 modelky, které tam skutečně patří, o třetinu méně a přesnost pořadí se nezhorší.

## [0.99.47] – 2026-10-27

### Přidáno
- **Úrovně Top 10 / 20 / 50 / 100 s těžším vstupem:** do vyšší úrovně se modelka dostane, až má dost porovnání a jistotu.
  - Prahy:
    - Top 10: 10 porovnání, nejistota nejvýš 0,3 a výhra nad některou z potvrzené Top 20.
    - Top 20: 6 porovnání.
    - Top 50: 4 porovnání.
    - Top 100: 2 porovnání; samotný odhad se sem nedostane nikdy.
  - Kdo podle síly patří výš, ale prahy ještě nesplňuje, čeká těsně pod hranicí. Do Top N se navíc potvrdí jen modelka, která je podle síly nejvýš na místě 2·N.
  - Číslo oblíbenosti se nemění, mění se jen potvrzené pořadí.
- **Souboje na hranicích úrovní:** Porovnávání do mixu zařazuje dvojice čekající modelky proti posledním potvrzeným v úrovni a souboje sousedek o 10., 20., 50. a 100. místo. Nad pásy mají štítek „⚔ Souboj o Top 10“ nebo „O postup do Top 10“. Po souboji se pořadí hned přepočítá, postup do vyšší úrovně ohlásí upozornění.
- **Úrovně v rozhraní:**
  - Pořadí: oddělovače úseků s počtem potvrzených, u čekajících „⏳ čeká na Top 10 (6 z 10 porovnání…)“ s místem podle síly a pravidla úrovní pod seznamem.
  - Profil ukazuje „· Top 10“ nebo čekání, karty modelek odznak TOP 10.
  - Přehled ukazuje v Top 10 jen potvrzené a počet čekajících s odkazem do Porovnávání.

### Změněno
- **Trend a šipky** sledují potvrzené pořadí, takže postup do Top 10 se ukáže jako vzestup. Starší denní snímky se dál porovnávají podle oblíbenosti.
- **Přesnost pořadí:** v simulaci se 400 modelkami odpovídá po 800 porovnáních prvních 10 míst skutečné Top 10 ze 74 % místo 66 %.

## [0.99.46] – 2026-10-27

### Změněno
- **Přepínání stránek pod hledáním jako přepínač, ne rozbalovací seznam:** všechny možnosti jsou vedle sebe a zvolená je zvýrazněná, klik přepne rovnou. Platí pro Oblíbenost (Porovnávání / Pořadí), Přehled sbírky (Přehled / Údržba / Sháním CZ / Statistiky, s počty) i Čísla (Obálky / Kalendář). V úzkém okně zůstanou jen ikony.

## [0.99.45] – 2026-10-27

### Změněno
- **Rychlejší pásy fotek v porovnání:** fotky se stahují postupně, až se v pásu přiblíží (místo všech 48 najednou zhruba 10 na pás, další při rolování), a ve velikosti podle výšky pásu (na běžném monitoru w400 místo w600). Další dvojice přednačte jen fotky, které budou hned vidět. Změna srdíček fotky přepíše jen její štítek (dřív se pás sestavoval znovu), pohyb myši mění zvýraznění jen u dvou fotek a neaktivní pás ztlumí lehký překryv místo průhlednosti celého pásu; tlačítko „♥ Tahle“ už nemá náročné rozmazané pozadí.

## [0.99.44] – 2026-10-27

### Změněno
- **Model vkusu („Mohlo by se ti líbit“, štítek „odhad“) bere i poměr hrudník/pas a věk při prvním vydání** (z data narození). Na zkušebních sbírkách, kde na nich vkus závisí, odhad zpřesnily (3000 modelek: Spearman 0,407 → 0,425, odhad u 76 % místo 66 % nehodnocených); kde ne, nic nemění. S malým počtem hodnocených škodily, proto se použijí až od 60 hodnocených modelek s tím údajem. Důvod odhadu je může uvést („věk 21 let“, „poměr hrudník/pas 1,52“).

## [0.99.43] – 2026-10-27

### Změněno
- **Oblíbenost sjednocená do jednoho modelu:** nehodnocená modelka má teď předpoklad síly z odhadu podle vkusu (s jeho nejistotou), jinak ze srdíček fotek – stejné číslo ukazuje štítek „odhad“, řadí galerii, určuje soupeřku v porovnání i návrh srdíček. Dřív se pro soupeřku bral odhad vkusu, ale pořadí a návrh vycházely z průměru sbírky nebo fotek. V Pořadí jsou proto i nehodnocené s odhadem podle vkusu (označené „odhad“).
- **Návrhy srdíček jen z jednoho místa:** po porovnání se už nenabízí skok o celé srdíčko po jediné volbě (pravidlo v rozhraní, které odporovalo „Nesedí se srdíčky“). Pod pásy se ukáže tentýž návrh jako v Pořadí – nehodnocené po pár porovnáních, hodnocené při nesouladu – se stejnou větou, „Dát jí“ i „Nechat“; „Nechat“ platí na obou místech.
- Věta o modelu vkusu počítá skutečně hodnocené modelky (dřív i odhadnuté v pořadí).
- Kód oblíbenosti rozdělený podle témat (výběr dvojic, návrhy srdíček) beze změny chování.

## [0.99.42] – 2026-10-27

### Přidáno
- **„Nesedí se srdíčky“ i podle srdíček fotek:** modelka, jejíž hodnocené fotky (aspoň 2 alba a 10 fotek) vycházejí aspoň o celé srdíčko jinde než její srdíčka, dostane návrh o půl srdíčka směrem k fotkám („Cecílie (2 ♥) má fotky za 4,6 (4 alba, 37 hodnocených) – možná jí patří 2½ ♥“). Když stejným směrem ukazují i porovnání, je to jedna položka a jde napřed; když proti sobě, platí porovnání. Ukáže se prvních 8, ostatní pod „Zobrazit všech“.
- V pásu porovnání je u jména **skóre fotek** („fotky 4,3“, v bublině z kolika alb a fotek).

## [0.99.41] – 2026-10-27

### Změněno
- **Porovnávání bez přepínání dvojic:** volba Stejné srdíčko / Všechny / I nehodnocené zmizela, program míchá dvojice sám – hlavně stejné a sousední úrovně, asi třetinu nehodnocených proti modelce s tolika srdíčky, kolik ukazuje jejich odhad (přednost mají rozpracované, aby se dotáhly k návrhu srdíček), a častěji modelky, kterým nesedí srdíčka.

### Přidáno
- **„Nesedí se srdíčky“ v Pořadí:** modelka s víc srdíčky, která v porovnáních soustavně prohrává se slabšími („Eva (4½ ♥) prohrála 3 ze 4 porovnání s modelkami s méně srdíčky – možná jí patří 4 ♥“), nebo naopak slabší vyhrávající se silnějšími, s tlačítky „Dát jí 4 ♥“ a „Nechat“. V Porovnávání je odkaz s počtem. Počítá se proti tomu, co by čekala samotná srdíčka, a až od tří takových porovnání.

## [0.99.40] – 2026-10-27

### Přidáno
- **Návrh srdíček pro nehodnocenou modelku z porovnání:** po aspoň třech porovnáních, když už je jasné, kam patří, se pod pásy nabídne „Nehodnocená Anna vychází po 4 porovnáních (výhry 2,5) na 3½ ♥ – Dát jí 3½ ♥ / Nechat“. Samé výhry nebo prohry nad jednou úrovní návrh nedají (ví se jen „výš“, ne o kolik) – nejdřív přijde soupeřka o úroveň dál. „Nechat“ návrh pro tu modelku do zavření programu nenabízí.

## [0.99.39] – 2026-10-27

### Změněno
- **Nehodnocené modelky (Dvojice: I nehodnocené) se porovnávají s modelkou, která má přesně tolik srdíček, kolik ukazuje jejich odhad** (odhad vkusu, jinak podle srdíček fotek, jinak průměr sbírky). Výhra posune další soupeřku o úroveň výš, prohra níž, takže pár porovnání najde, kam modelka patří. Když nikdo s takovým počtem srdíček není, vybere se nejbližší úroveň. Pod pásy je důvod, např. „Odhad podle vkusu: 3½ srdíčka – proti modelce s 3½ srdíčka: vyhraje-li, patří výš, prohraje-li, níž“.

## [0.99.38] – 2026-10-27

### Opraveno
- **Fotka z pásu v porovnání se otevírá v běžném prohlížeči fotek** (stejném jako u alb: lupa, otáčení, lišta alb, srdíčka, slideshow) na té fotce mezi všemi fotkami modelky; po zavření se vrátíš k porovnání a pás té modelky ukáže nová srdíčka fotek. Dosavadní jednoduché zvětšení zmizelo.

## [0.99.37] – 2026-10-27

### Změněno
- **Pás fotek v porovnání má vlevo titulní fotku** se jménem (otevře profil), srdíčky modelky (jdou rovnou měnit), počtem fotek a tlačítkem „♥ Tahle“; pás fotek pokračuje hned vedle.
- **Pořadí a Mohlo by se ti líbit jsou zase jedna část** (vedle sebe); Oblíbenost má pod hledáním jen Porovnávání a Pořadí.

## [0.99.36] – 2026-10-27

### Změněno
- **Porovnávání bez titulních fotek – rovnou dva pásy fotek nad sebou:** nahoře nejlepší fotky jedné modelky, dole druhé, přes výšku okna. Pás pod myší je aktivní (Tab přepne): kolečko nebo ← → jím listují, klik fotku zvětší, 1–5 jí dá srdíčka, „♥ Tahle“ nebo Enter vybere modelku, ↓ nebo mezerník = stejně. Samostatné okno „Fotky obou“ už není potřeba.
- **Oblíbenost má části pod hledáním** jako Přehled: Porovnávání, Pořadí a Mohlo by se ti líbit (každá přes celou stránku); u Porovnávání je tam i volba Dvojice (Stejné srdíčko, Všechny, I nehodnocené). Pořadí v profilu modelky otevře rovnou část Pořadí.

## [0.99.35] – 2026-10-27

### Změněno
- **Porovnávání v Oblíbenosti podle titulních fotek, fotky obou modelek naráz po kliku:** pás malých náhledů pod fotkou zmizel. Klik na titulní fotku (nebo klávesa F) otevře přes celé okno dvě nezávislé galerie nad sebou – nahoře fotky levé modelky, dole pravé, každá až 24 nejlepších fotek (nejlepší z každého alba napřed). Každá se listuje zvlášť kolečkem nebo šipkami v polovině pod myší (Tab přepne), klik fotku zvětší, 1–5 jí dá srdíčka. Vybrat jde rovnou v galerii („♥ Tahle“ nebo Enter, ↓ = stejně), Esc vrátí k porovnání. Na titulní fotce je počet fotek modelky.

## [0.99.34] – 2026-10-26

### Přidáno
- **Oblíbenost se učí průběžně z toho, co v aplikaci děláš:** otevření profilu modelky a čas prohlížení jejích fotek v prohlížeči posouvají modelku v pořadí uvnitř jejích srdíček. Čerstvý zájem váží víc (poloviční váha po dvou měsících). Kolik zájem váží, se program učí z tvých porovnání modelek se stejnými srdíčky (výchozí malá váha, srdíčka nikdy nepřebije). Ukládá se jen do `playboy-uceni.db` (úprava č. 3 databáze učení), nic neopouští počítač.
- **Vývoj v čase:** program si každý den pamatuje pořadí oblíbenosti. V profilu je pod srdíčky „12. v oblíbenosti · ▲ 3 za 30 dní“ (klik otevře Oblíbenost), na kartě modelky malá šipka při výrazném posunu, v Oblíbenosti u každé modelky posun a řádek „Stoupají / Klesají“. Trend se ukáže po týdnu.
- **Úvod Přehledu má kartu Oblíbenost:** Top 10, Stoupají a Dlouho jsi neviděl (oblíbené, jejichž profil jsi měsíc neotevřel; ukáže se po měsíci sledování).
- **Sháním CZ: „Nejdřív sháněj“** – sháněná čísla s tvými nejoblíbenějšími modelkami napřed.

### Změněno
- Nejlepší fotky a stěna centerfoldů Podle srdíček řadí fotky se stejnými srdíčky podle oblíbenosti modelky.
- Údržba: priorita počítá s oblíbeností modelky (údaje oblíbených se doplňují dřív) a fronta má řazení „oblíbené napřed“.
- „Zapomenout porovnání“ maže i zájem a historii oblíbenosti.

## [0.99.33] – 2026-10-26

### Změněno
- **Filtr srdíček na kartách modelek (♥ 3+, ♥ 4+ …) řadí podle oblíbenosti:** zapnutí filtru samo přepne řazení na „Podle srdíček“ (nejvíc srdíček nahoře, se stejnými srdíčky podle oblíbenosti), vypnutí vrátí řazení, které bylo předtím. Když během filtru zvolíš jiné řazení, zůstane.

## [0.99.32] – 2026-10-26

### Změněno
- **Řazení galerie „Podle srdíček“ řadí modelky se stejnými srdíčky podle oblíbenosti** (porovnávání a skóre fotek), takže i s filtrem ♥ 4+ vidíš skutečné pořadí místo náhodného. Nehodnocené modelky jsou na konci seřazené podle odhadu z fotek. Samostatné řazení „Podle oblíbenosti“ je díky tomu zbytečné a zmizelo (kdo ho měl zvolené, má teď „Podle srdíček“); dřív navíc míchalo nehodnocené modelky mezi hodnocené a trhalo lištu srdíček.

## [0.99.31] – 2026-10-26

### Změněno
- **Přesnější odhad oblíbenosti u nehodnocených modelek (model vkusu):** kombinuje regresi s rozhodovacími stromy, takže zachytí i nelineární vkus (např. „líbí se mi jen určitá kombinace údajů“). Štítek „odhad“ se ukáže jen tam, kde odhad na ověření prokazatelně překoná prostý průměr; na umělých sbírkách je chyba ukázaných odhadů zhruba o 10 % menší a pořadí „Mohlo by se ti líbit“ sedí lépe.
- Najetí myší na štítek „odhad“ v galerii ukáže **důvod**: které údaje odhad nejvíc zvedly nebo snížily a které hodnocené modelky jsou nejpodobnější.

## [0.99.30] – 2026-10-26

### Změněno
- Oblíbenost má vlastní tlačítko: **graf** vpravo v liště otevře rovnou porovnávání a pořadí modelek (bez volby pod hledáním). Hned vedle je nové tlačítko **Přehled sbírky** (deska se seznamem) pro Přehled, Údržbu, Sháním CZ a Statistiky – otevře naposledy zvolenou z nich a přepínají se volbou pod hledáním. V liště svítí tlačítko otevřené části.

## [0.99.29] – 2026-10-26

### Přidáno
- V Oblíbenosti → Pořadí jsou i **nehodnocené modelky s hodnocenými fotkami**: zařadí je odhad ze skóre jejich fotek, v seznamu jsou tlumeně se štítkem „odhad z fotek“ (důvod v bublině), dokud je neohodnotíš nebo neporovnáš. Stejný odhad používá i řazení galerie podle oblíbenosti. Pořadí se ukáže už ze srdíček a fotek, bez nutnosti porovnávat.

## [0.99.28] – 2026-10-26

### Změněno
- **Porovnávání v Oblíbenosti s náhledem galerie:** pod velkou fotkou každé modelky je řada náhledů z jejích alb (nejlepší fotka z každého alba, pak podle srdíček). Najetí myší ukáže náhled velký na své straně, klávesy 1–8 ukážou n-tou nejlepší fotku na obou stranách najednou, ↑ listuje, 0 vrátí titulní fotky; klik otevře prohlížeč na té fotce a po zavření se vrátíš k porovnání.
- **Spravedlivější pořadí – počítá i se srdíčky fotek v albech:** každé album je jeden hlas (víc fotek nepřeváží), hodnotu alba dávají jeho nejlepší fotky (slabší fotky navíc album nezhorší) a málo hodnocených fotek se stahuje k průměru sbírky (jedna fotka za 5 srdíček ≠ jistých 5). Kolik váží fotky proti srdíčkům modelky, se program učí z tvých porovnání modelek se stejnými srdíčky (výchozí 0,3, nejvýš 0,8). Srdíčka modelky jsou teď měkký předpoklad: fotky a porovnání můžou pořadí posunout o půl srdíčka, o celé nikdy.
- V Pořadí je u modelky rozpad: srdíčka, skóre fotek (počet alb a hodnocených fotek) a porovnání, s důvodem, a věta, kolik fotky právě váží.

## [0.99.27] – 2026-10-25

### Změněno
- **Rychlejší backend:** sbírka se načte jedním průchodem a pamatuje se, dokud se databáze nezmění (Přehled, Údržba, návrhy, učení, oblíbenost i statistiky ji sdílejí místo opakovaného načítání). Na sbírce 3000 modelek: seznam modelek 163 → 2 ms, hledání ~180 → 6 ms, Přehled 283 → 8 ms, návrhy 237 → 5 ms; po změně dat zhruba o polovinu rychlejší. Export 2× a import 2,5× rychlejší, vložení 200 odkazů 5× rychlejší; méně paměti.
- **Rychlejší rozhraní:** skryté přehledy (galerie, čísla, nejlepší) po odchodu uvolní paměť, galerie má jednu obsluhu kliků místo tisíců, profil neměří stránku opakovaně, klávesy nehledají v celé stránce. Na sbírce 3000 modelek (zpomalený procesor): otevření okna modelky −86 %, rolování profilu −81 %, prohlížeč fotek −65 %, přepnutí na Nejlepší −73 %, Údržba −69 %. Editor textu (CodeMirror) a historie změn se načítají až při použití – hlavní skript je o polovinu menší, start rychlejší.
- Úklid nepoužívaného a zdvojeného kódu v backendu i rozhraní.

## [0.99.26] – 2026-10-25

### Přidáno
- **Hodnocení modelek po půlsrdíčkách** (0–5 po 0,5): klik na levou půlku srdíčka dá půlku, na pravou celé; klávesy 1–5 celá srdíčka, stejná číslice znovu přidá půlku, 0 zruší. Na kartách, v profilu, v Údržbě i v okně Doplnit modelku; hodnoty s čárkou („3,5“). Hledání `hodnoceni:3,5`, `>=3,5`. Srdíčka fotek zůstávají celá.
- **Porovnávání dvojic** v nové části Přehledu **Oblíbenost**: dvě velké fotky, ←/→ vybereš, která se ti líbí víc, ↓ nebo mezerník remíza, S přeskočí, Backspace vrátí. Program vybírá dvojice, u kterých si je pořadím nejméně jistý (hlavně ve stejném srdíčku). Pořadí se počítá modelem Bradley–Terry ze srdíček a porovnání; když volba hodně odporuje srdíčkům, nabídne úpravu hodnocení.
- **Model vkusu** (strojové učení z tvé sbírky): odhadne hodnocení nehodnocených modelek z jejich údajů a srdíček jejich fotek – jen když na tvé sbírce ověřitelně funguje (křížové ověření). Odhad je vidět jako tlumený štítek „odhad 3½“ s důvodem; část **Mohlo by se ti líbit** ukáže nehodnocené modelky s nejvyšším odhadem (rovnou je jde ohodnotit). Galerie má řazení **Podle oblíbenosti**.
- Porovnání se ukládají do databáze učení; „Zapomenout naučené“ je nemaže (jsou to tvoje výslovné volby), smazání souboru učení ano.

### Změněno
- **Výjimka v betě se změnou schématu:** úprava databáze č. 13 (`modelky.hodnoceni_pul`, polovina srdíčka) a export verze 9 (`hodnoceni: 3.5`). Před úpravou vznikne záloha `*-pred-migraci.db`, stará hodnocení zůstanou stejná; starší program novou databázi otevře jen pro čtení (3½ ukáže jako 3). Import přijme exporty 1–9; hodnocení mimo 0–5 po půlkách odmítne. Ve výčtu hledání znamená `hodnoceni:4,5` nově 4½ (desetinná čárka), „4 nebo 5“ se píše `4..5`.

## [0.99.25] – 2026-10-25

### Změněno
- **Údržba ve třech režimech** místo dlouhého seznamu: nahoře jeden řádek (úplnost sbírky, počty úkolů, kontroly a návrhů) a přepínač **Po údajích / Po modelkách / Souhrn**; program si pamatuje poslední režim.
  - **Po údajích** (výchozí): vlevo chybějící údaje s počty a návrhy, vpravo modelky, kterým vybraný údaj chybí, s polem k vyplnění přímo v řádku (našeptávání ze sbírky, výběry, srdíčka, odkaz na fotku, převody `5'7"`, `115 lbs`, `34B-24-34`). Návrh je předvyplněný i s důvodem. **Enter uloží a skočí na další řádek**, Esc vrátí hodnotu, Delete označí Netýká se (s Vrátit). „Přijmout N návrhů“ a „Netýká se všem…“ pro celý údaj.
  - **Po modelkách**: karta jedné modelky se všemi úkoly (dřívější soustředěný režim, teď bez mezikroku), vpravo fronta s jedním výběrem filtru; Enter další pole, Ctrl+Enter uloží a otevře další modelku, srdíčka klávesami 1–5.
  - **Souhrn**: oba panely (úplnost, Co se program naučil) a celý seznam s bočními filtry a Vyřízenými.
- Řádky „Co zbývá doplnit“ na úvodu Přehledu otevřou Po údajích rovnou na daném údaji.

## [0.99.24] – 2026-10-25

### Změněno
- Části Přehledu (Přehled, Údržba, Sháním CZ, Statistiky) se už nevybírají z nabídky u tlačítka s grafem: tlačítko rovnou otevře Přehled na naposledy zvolené části a mezi částmi se přepíná volbou s ikonou pod hledáním – stejně jako Obálky / Kalendář u Čísel. U Údržby je v nabídce počet úkolů.

## [0.99.23] – 2026-10-25

### Změněno
- **Údržba pod oběma panely uklizená** (varianta A): vlevo boční panel s filtry po oblastech a počty (Fronta, Modelky, Alba, Čísla, Vyřízené; u Návrhů a Kontroly podseznam zdrojů), vpravo jeden pruh **Další krok** („Přijmout jisté“, „Začít postupně →“) místo karet, pruhu návrhů a lišty s tlačítkem, pod ním jedna lišta s hledáním, řazením a ⋯ Hromadně. Řádky ukazují jen souhrn (nejvýš tři štítky) a jedno hlavní tlačítko, podrobnosti a všechny akce po rozbalení. V úzkém okně se boční panel změní na výběr v liště.

### Přidáno
- **Soustředěný režim** (varianta C): „Začít postupně“, klávesa S nebo ⋯ „Vyřídit v soustředěném režimu“ otevře velkou kartu jedné modelky se všemi úkoly k vyřízení na místě – chybějící údaje rovnou napíšeš nebo vybereš (i srdíčka a odkaz na titulní fotku), nález kontroly opravíš nebo označíš V pořádku, návrh přijmeš ✓ nebo odmítneš ✕ (úprava hodnoty se zapíše jako oprava pro učení); co na místě nejde (text a vydání alba, cover, centerfold), otevře stávající okno. Vpravo fronta „Na řadě“ podle filtru a řazení. Ctrl+Enter uloží a otevře další, PageUp/PageDown nebo Alt+←/→ předchozí a další, Esc zpět na seznam (s rozepsanými změnami se zeptá „Zahodit změny?“). Ukládá jen změněná pole.

## [0.99.22] – 2026-10-25

### Přidáno
- **Vlastní databáze učení** `playboy-uceni.db` vedle sbírky (sbírka ani export se nemění; když soubor chybí nebo je poškozený, učení začne znovu): deník rozhodnutí (přijato, odmítnuto, opraveno, „V pořádku“, „Znovu kontrolovat“), odmítnutí konkrétní hodnoty místo celého údaje, kalibrace jistoty podle toho, jak často který zdroj trefí (zdroj, který stále odmítáš, sám zmizí), mezipaměť výpočtů. Kontrola zpřísní pravidla, která často označuješ „V pořádku“. Popis v `docs/UCENI.md`.
- Návrhy spojují víc zdrojů (souhlasné zvýší jistotu, odporující se ruší), nový zdroj **podobné modelky** odhadne chybějící míry z nejpodobnějších modelek; u každého návrhu je vidět zdroj.
- V Údržbě panel **Co se program naučil**: úspěšnost zdrojů, počty přijatých / odmítnutých / opravených, „Zapomenout naučené…“ (se zálohou). Úprava návrhu přes „Upravit…“ a uložení jiné hodnoty se zapíše jako oprava.

### Změněno
- **Stránka Údržba přepracovaná:** nahoře úplnost sbírky po oblastech (klik zapne filtr) a „Co doplnit dál“ (čtyři nejcennější úkoly; Playmate bez data narození první), lišta filtrů s počty, hledání jména nebo čísla (Ctrl+F nebo /), řazení, skupiny po modelkách jdou sbalit, jeden vzhled řádku pro úkoly, nálezy Kontroly i návrhy. Klávesy ↑↓ PgUp/PgDn Home/End, →/← rozbalí a sbalí, Enter hlavní akce, Delete odloží, E upraví návrh. Hromadné akce se vždy zeptají a jdou vrátit; jeden přepínač „Vyřízené“ ukáže netýká se, v pořádku i odmítnuté.
- Rychlejší Přehled a Údržba: opakované otevření na velké sbírce asi 3× rychleji, akce v Údržbě už nenačítají celý Přehled znovu.

### Opraveno
- Klik do řádku Údržby otevíral profil; modelka s nálezem kontroly byla ve frontě dvakrát; „Hromadně“ a ⋯ hned zavíraly nabídku.
- Z nezávislé revize (`docs/REVIZE-UDRZBA-UCENI.md`): obnovení ze zálohy se nebere jako oprava nálezů; „V pořádku“ a „Netýká se“ hlásí chybu, když se neuloží; klik během překreslení fronty se neztratí; oprava návrhu se zapisuje správně (i změna jen tvaru zápisu, ne vymazané pole); výpočet návrhů běží jen jednou najednou a další drobnosti.

## [0.99.21] – 2026-10-25

### Opraveno
- Uložení alba (a podobně klik na tag ve formuláři modelky) šlo někdy až na druhý klik: po opuštění pole se znovu přepsal náhled i text tlačítka „Uložit … fotek“ a WebKitGTK první klik zahodil, protože se obsah tlačítka mezi stisknutím a puštěním myši vyměnil. Náhledy a texty se teď přepisují jen při skutečné změně.

## [0.99.20] – 2026-10-25

### Změněno
- Kategorii **Cyber Girl** dává modelce jen album **Cyber Girl of the Week** nebo **of the Month** (Cyber Girl týdne / měsíce). Obyčejné album Pictorial online už Cyber Girl nepřidává; proužek u profilovky pak ukazuje „Online“. Výskyt „jen online“ zůstává.

## [0.99.19] – 2026-10-25

### Přidáno
- **Návrhy doplnění v Údržbě** (strojové učení ze tvé sbírky, nic neodchází z počítače): program navrhne chybějící údaje s jistotou v procentech a důvodem, např. „místo narození Texas → USA (ve sbírce 12 z 12 modelek odtud)“. Zdroje:
  - národnost z místa narození (tabulka zemí, států USA a měst + co je ve sbírce) a podle edice, ve které modelka vyšla;
  - etnicita podle národnosti, barva vlasů a očí podle etnicity a národnosti – jen když je sbírka jednoznačná;
  - obvody a velikost prsou z textu měr (cm i palce), odhad chybějícího obvodu z ostatních měr (vždy jen „odhad“);
  - kategorie Playmate roku z poznámky či tagů (rok musí sedět k centerfoldu);
  - vydání alba z data v názvu nebo z čísla jejího centerfoldu, datum online alba z názvu, fotograf alba podle alba stejného čísla nebo ostatních alb modelky.
  Hodnoty se píšou tak, jak je ve sbírce zapisuješ. Jistota se ověřuje na údajích, které už ve sbírce máš; spory a slabé důkazy se nenabízejí. Odmítnutí program bere jako poučení – podobné návrhy pak nenabízí.
- V Údržbě nová část **Návrhy** (počet i v hlavičce a na úvodu Přehledu): po modelkách a albech, u každého hodnota, jistota (jisté ≥ 90 %, pravděpodobné ≥ 70 %, odhad), důvod a ✓ Přijmout / Upravit… (otevře formulář nebo okno alba s předvyplněnou hodnotou) / ✕ Odmítnout. Hromadně „Přijmout vše jisté“ a „Přijmout vše u modelky“ (jedna transakce, před ní záloha „Před přijetím návrhů“), „zobrazit i odmítnuté“ s Vrátit, Vrátit v oznámení. Klávesy: Enter přijme, Delete odmítne, šipky mezi řádky.
- Odmítnutí se ukládá mezi „netýká se“ (klíče `nv-*`), takže ho nese i export; bez změny databáze.

## [0.99.18] – 2026-10-25

### Změněno
Okna programu sjednocená do vzhledu okna alba (vlevo volby a náhled, vpravo pole), každé s křížkem, Ctrl+Enter a bez vodorovného posouvání v úzkém okně:
- **Formulář modelky:** vlevo části formuláře (klik doroluje, tečka = vyplněno) a náhled „V profilu bude“ s pruhem „Vyplněno X z 18 údajů“; vpravo hustší pole (méně rolování). Živé nápovědy: věk z data narození, chybné datum, americké míry (`5'7"` → 170 cm, `115 lbs` → 52 kg, `34B-24-34`), BMI, upozornění na stejné jméno ve sbírce. Tagy se přidávají a odebírají klikem. Doplnit modelku je širší, převádí míry stejně a má křížek.
- **Okno alba:** vejde se i na nízkou obrazovku (pole se posouvají, tlačítka zůstávají dole), tišší a kratší nápovědy, náhled s obrázkem první vložené fotky a počtem fotek, volby jdou ovládat šipkami.
- **Okno coveru:** náhled obálky z vloženého odkazu s páskou čísla, Měsíční/Speciál jako volby vlevo.
- **Okno čísla:** obálka se štítkem stavu, stav ve sbírce jako volby, u „Na obálce“ hned vidět, jestli se jméno propojí s profilem.
- **Okno článku:** živé záhlaví (rubrika · strana · druh), pole přeskupená, upozornění na neznámou modelku hned při psaní, počet a náhledy skenů.

### Přidáno
- Společný editor textu i pro **poznámku modelky** a **poznámku čísla**. Editor ukazuje, který formát je u kurzoru (opakovaný klik ho vypne), odrážky jako tečky, u článku perex a mluvčí jako ve čtečce, tlačítko **Náhled** (přesně jako v profilu/čtečce), počet slov a znaků; Enter v číslovaném seznamu přečísluje položky.

## [0.99.17] – 2026-10-25

### Změněno
- **Okno alba ve dvou sloupcích** (varianta A): vlevo se volí Kde vyšlo, Druh a u časopisu Číslo (přepínače pod sebou) a pod nimi je náhled „V profilu bude: …“ s názvem a popisem alba, jak se ukáže v profilu. Vpravo jsou jen pole, která zvolený typ potřebuje; týden nebo měsíc Cyber Girl je vidět přímo v poli Nafoceno. Pod odkazy je počet rozpoznaných fotek a tlačítko ukazuje „Uložit 12 fotek“. V úzkém okně jsou sloupce pod sebou.

### Přidáno
- **Společné okno pro psaní textu** – průvodní text alba i text článku. Text je vidět rovnou naformátovaný (tučně, kurzíva, přeškrtnutí, nadpisy, citáty, odrážky, u článku mluvčí „PLAYBOY:“); značky markdownu se objeví, jen když je kurzor v daném místě. Lišta nástrojů, Ctrl+B / Ctrl+I, Enter v odrážkách pokračuje další odrážkou (na prázdné odrážce seznam ukončí), Ctrl+Enter text použije, Esc s rozepsaným textem se zeptá „Zahodit změny?“. V okně alba a článku je místo pole náhled textu; klik na něj otevře editor. Editor stojí na knihovně CodeMirror 6 (nová závislost rozhraní).

## [0.99.16] – 2026-10-25

### Změněno
- **Speciály v okně coveru zvlášť:** stejně jako v okně alba má okno coveru řadu **Číslo** – Měsíční, nebo Speciál s vlastním výběrem speciálů zvoleného roku a edice („Nový speciál…“). Cover speciálu se otevře rovnou s volbou Speciál. Po změně roku nebo edice se vybraný speciál zruší (patří ke konkrétnímu roku).

## [0.99.15] – 2026-10-25

### Změněno
- Výběr měsíce v oknech alba a coveru má u českého názvu anglický v závorce („Červen (June)“).
- **Speciály v okně alba zvlášť:** u Časopisu přibyla řada **Číslo** – Měsíční, nebo Speciál. Výběr měsíce má jen dvanáct měsíců, speciál má vlastní výběr se speciály zvoleného roku a edice a volbou „Nový speciál…“. Album u speciálu se otevře rovnou s volbou Speciál. (Okno coveru má speciály zatím ve výběru měsíce.)

## [0.99.14] – 2026-10-25

### Změněno
- **Výběr typu alba ve dvou krocích:** v okně alba je místo rozbalovacího seznamu nahoře řada **Kde vyšlo** (Časopis / Online / Nikde) a pod ní **Druh** – u časopisu Pictorial nebo Centerfold, u online Pictorial, Cyber Girl of the Week nebo of the Month, „Nikde“ je pictorial bez čísla i data. Okno ukazuje jen pole, která zvolený typ potřebuje (vydání, nebo datum nafocení s týdnem či měsícem). Uložený pictorial bez čísla se otevře jako „Nikde“; starší typy (Cover…) zůstanou jako další druh u časopisu. Pole Fotograf je pod názvem alba.

## [0.99.13] – 2026-10-25

### Přidáno
- **Cyber Girl of the Month:** v okně alba u Pictorial online je místo zaškrtávátka výběr **Cyber Girl**: of the Week (týden z celého data) nebo of the Month (měsíc z data, stačí RRRR-MM). Nadpis alba „Cyber Girl měsíce · červen 2004“, modelka dostane kategorii **Cyber Girl měsíce** (má přednost před týdne). V exportu nová hodnota typu `Cyber Girl měsíce`, bez změny databáze.

## [0.99.12] – 2026-10-24

### Přidáno
- **Cyber Girl of the Week:** v okně alba u typu Pictorial online nová volba „Cyber Girl of the Week“. Program z celého data nafocení (RRRR-MM-DD) spočítá týden v roce podle ISO 8601 a ukáže ho hned v okně; nadpis alba v profilu „Cyber Girl týdne · 24. týden 2004 (nafoceno 12. 6. 2004)“. Modelka dostane odvozenou kategorii **Cyber Girl týdne** (i když má zapsané Online), proužek u profilovky zůstává „Cyber Girl“.
- Album se ukládá jako typ `Cyber Girl týdne` – bez změny databáze; v exportu je to nová hodnota `typ` (starší 0.99.9–0.99.11 ji při importu nepřijme).

## [0.99.11] – 2026-10-24

### Změněno
- Proužek online alb v profilu je sjednocený a bez data: **Cyber Girl**, jinak **Online**. Cyber Girl má přednost před Online (i když má modelka zapsané obojí); Coed, Muse a další online kategorie se zatím ukazují jako Online. Proužek je jen jeden, i když má modelka víc online alb.

## [0.99.10] – 2026-10-24

### Přidáno
- Online album (Pictorial online) dává modelce odvozenou kategorii **Cyber Girl**, stejně jako centerfold dává Playmate měsíce. Když má modelka zapsanou jinou online kategorii (Coed, Muse, Creator…), použije se ta. Funguje ve filtru Kategorie, ve Statistikách i v hledání `kategorie:"cyber girl"`.
- Proužek v rohu fotky v profilu: u online alba „Cyber Girl · Čvn 04“ (datum nafocení, bez data jen kategorie); klik přejde na album.

## [0.99.9] – 2026-10-24

### Přidáno
- Nový typ alba **Pictorial online** pro pictorialy, které vyšly jen na webu (např. Cybergirl). Nemá vydání (měsíc, rok, edici), místo toho volitelné pole **Nafoceno** – datum, kdy bylo album nafoceno. Je to jen informace u alba, na profil modelky (narození, výskyt) se nepřenáší. V profilu se ukáže v nadpisu alba („Pictorial online · nafoceno červen 2004“).
- Modelka s online albem a bez čísla časopisu má výskyt „online“. Hledání `nafoceno:2004` (i `nafoceno:2004-06`, čárka = nebo, `-nafoceno:` vylučuje); ve Statistikách druh výskytu „Online“.
- Online alba nejsou v kalendáři, mezi čísly, na titulní fotce ani v Údržbě mezi „alby bez vydání“.

### Změněno
- **Výjimka v betě:** úprava databáze č. 12 (sloupec `datum` u alb) a export verze 8 (klíč `datum` u alba). Před úpravou vznikne záloha `*-pred-migraci.db`; starší exporty (verze 1–7) se dál načtou. Starší program novou databázi otevře jen pro čtení. Lhůta 14 dní do 1.0.0 běží znovu od této verze.

## [0.99.8] – 2026-10-23

### Opraveno
Další nálezy revize kódu (`docs/REVIZE-GO-DATA.md`, `docs/REVIZE-ROZHRANI.md`):
- Opakovaný import exportu z jiné databáze (nebo ručně psaného souboru) zakládal stejnojmenné modelky znovu; když nejde jednoznačně poznat, která to je, modelka se přeskočí s hláškou.
- Obnovení zálohy, která mezitím zmizela, obnovilo prázdnou sbírku; teď se nic nezmění. Zálohy se otevírají opravdu jen pro čtení.
- Sloučení modelek přenese i články a označení „netýká se“ / „V pořádku“.
- Export, při kterém se nepodaří načíst část dat, skončí chybou místo neúplného souboru.
- Přejmenování fotografa a tagu, úprava coveru a uložení výsledku kontroly souborů proběhnou celé, nebo vůbec; chyba zápisu se ohlásí.
- Vložení samých nefunkčních odkazů už nezaloží prázdné album.
- Zamčený program neukazuje pole hledání; křížky prohlížeče, čtečky, oznámení a zavření programu a pole článku mají popisky pro čtečku; text pod grafem Statistik („tažení myší období“, „nejsou“); fokus z klávesnice je vidět i u vybraného řádku grafu.

## [0.99.7] – 2026-10-23

### Opraveno
- Instalátor: neznámý nebo překlepnutý přepínač (třeba `--odinstaluj`) už program nesestaví a nenainstaluje, ale ohlásí chybu; nový přepínač `--napoveda`. Před sestavením zkontroluje verzi Go a srozumitelně poradí `sudo dnf upgrade golang`. Cesta v položce nabídky je v uvozovkách (domovská složka s mezerou).

### Přidáno
- `./zkontrolovat.sh` spustí všechny kontroly najednou: sestavení rozhraní, testy a typy, gofmt, vet, testy Go, volitelně shellcheck a govulncheck.
- Test verze hlídá i kontrolní součet `package.json.md5` a verzi v `package-lock.json`; nový test porovná vazby rozhraní (`App.js`) s metodami backendu.

### Změněno
- README a ROADMAP sjednocené s pravidlem verzování (bez značek v gitu); návod na testy na čerstvém klonu.

## [0.99.6] – 2026-10-23

### Opraveno
Nálezy revize kódu (zprávy v `docs/REVIZE-*.md`):
- Dotaz „Zahodit změny?“ se u článku, úpravy čísla, Doplnit modelku a rychlé Nové modelky ukazoval pod oknem (chyba z 0.99.4) – teď je navrchu, Esc a Tab patří jemu; po zrušení mazání článku zůstanou rozepsané změny chráněné; po „Uložit a další album“ se Esc zbytečně neptá.
- Doplnit modelku: zvolená srdíčka a titulní fotka jsou rozepsané změny – Esc i tlačítka, která okno opustí, se nejdřív zeptají.
- Hledání `rok:1975-01` a `narozena:1975-03` vracelo všechny modelky do roku 1975 (bralo se jako rozsah 1–1975); teď najde číslo nebo měsíc narození. Ve frontendu totéž pro `vydani:1975-01` v Číslech, Kalendáři, na stěně a v Nejlepších.
- Vložené odkazy smíšené s holými ID souborů: holá ID se tiše ztrácela, teď se vloží všechna.
- Kontrola: datum úmrtí zapsané jen rokem („1980“) se hlásilo jako „před prvním vydáním 1980-08“; data se porovnávají na společnou přesnost.
- Statistiky: návrat Zpět ze seznamu modelek už nezruší výběr; přerušené tažení v grafu výběr nerozbije.
- Zpět na profil smazané nebo sloučené modelky se přeskočí a otevře se předchozí místo.

## [0.99.5] – 2026-10-23

### Změněno
- Pravidlo verzování zapsané v ROADMAP.md (oddíl „Pravidlo verzování“): tvar `x.xx.xx` – MAJOR.MINOR.PATCH bez nul na začátku, MINOR a PATCH 0–99; MAJOR = milník, MINOR = téma z plánu, PATCH = krok nebo oprava; každá změna = nová verze se zápisem v changelogu; značky v gitu se nedělají.
- Test verze hlídá nový tvar a to, že aktuální verze je v changelogu nahoře a vyšší než předchozí.

## [0.99.4] – 2026-10-23

### Opraveno
- Esc, křížek nebo Zrušit u rozepsaného článku, úpravy čísla, Doplnit modelku a rychlé Nové modelky se teď zeptá „Zahodit změny?“ – dřív se text tiše ztratil.
- Album s víc fotografy (oddělenými čárkou, např. „Pompeo Posar, Arny Freytag“) se ukáže na stránce každého z nich; přejmenování fotografa změní jen toho jednoho a nezdvojí jméno, které už v albu je.
- Drobnosti: dvojitá trojtečka u „Přidat fotky nebo album…“, aktuální rada v prázdném čísle („+ Pictorial“), křížky oken mají popisek pro čtečku a bublinu „Zavřít (Esc)“.

### Plán
- Dílčí kroky a rozšíření řady 1.x v `docs/PLAN-1X-DISK.md`, `PLAN-1X-DATA.md`, `PLAN-1X-TEXTY.md`, `PLAN-1X-ROZSIRENI.md`; 1.0.0 nejdřív 6. 11. 2026 (chyby z bety opravené 23. 10.).

## [0.99.3] – 2026-10-23

### Opraveno
- Nepodařené uložení srdíček modelky hlásilo chybu „uložení hodnocení fotky“; teď správně „uložení hodnocení modelky“.

### Plán
- ROADMAP: návrhy strojového učení po 1.0 – 1.16 Kontrola 2.0 (postava podle období, jistota nálezů, učení z oprav), 1.17 Mohlo by se ti líbit (odhad srdíček, doporučení, volitelně malá neuronová síť), 1.18 Postřehy ve Statistikách (trendy, zlomy, výběr proti sbírce); rozbor v `docs/NAVRH-KONTROLA2.md`, `docs/NAVRH-DOPORUCENI.md`, `docs/NAVRH-POSTREHY.md`.

## [0.99.2] – 2026-10-22

### Přidáno
- Kontrola v Údržbě se učí ze sbírky (`kontrola_uceni.go`, bez nových knihoven):
  - Rozsahy výšky, váhy, BMI, obvodů a věku při prvním vydání se odvodí z modelek ve sbírce (robustní medián ± 4,5 σ), když je údajů aspoň 30; u menší sbírky platí pevné hranice. Dolní hranice věku zůstává 18 let.
  - „Neobvyklá kombinace údajů“: modelka, jejíž údaje jsou každý zvlášť v pořádku, ale dohromady ne (Mahalanobisova vzdálenost od středu sbírky); nález řekne, který údaj a jaká hodnota by byla obvyklá.
  - „Podobné jméno“: skoro stejná jména dvou modelek (překlep, prohozené jméno a příjmení, pseudonym), podpořená stejným datem narození nebo prvním vydáním; jiný rok narození shodu vyloučí.
  - Učení z „V pořádku“: tři a více potvrzených hodnot za hranicí, které na ni navazují, hranici posunou (potvrzené šestnáctileté playmate → věk 16 se už nehlásí); podobné potvrzené kombinace se přestanou hlásit.
- Kontrola sbírky s 5 000 modelkami trvá zhruba 80 ms.

## [0.99.1] – 2026-10-22

### Změněno
- Části Přehledu (Přehled, Údržba, Sháním CZ, Statistiky) jsou v kontextové nabídce tlačítka Přehled vpravo v liště (ikona grafu); tlačítko samo zůstává stejné. Volba otevře Přehled rovnou na té části, v otevřeném Přehledu jen přepne část (✓ u zvolené, u Údržby a Sháním CZ počet). Volba části v liště pod hledáním z 0.99.0 odpadla.

## [0.99.0] – 2026-10-22

### Změněno
- Přehled: části Přehled, Údržba, Sháním CZ a Statistiky už nejsou velká lišta přes celou šířku, ale rozbalovací volba v horní liště – stejně jako zobrazení Čísel (Obálky / Kalendář). Tlačítko ukazuje ikonu a název zvolené části, nabídka i počet úkolů Údržby a čísel Sháním CZ. Obsah tak začíná hned nahoře.

### Opraveno
- Statistiky: osa grafů počtů má jen celá čísla (při malých počtech ukazovala 0,2, 0,4…).

## [0.98.0] – 2026-10-22

### Změněno
- Statistiky už se neomezují na modelky s centerfoldem. Grafy v čase počítají každou modelku jednou, v roce jejího prvního výskytu v časopise – centerfold, obálka nebo pictorial u čísla. Přepínač Vše / Centerfold / Obálka / Pictorial vybere, který výskyt se počítá (Centerfold odpovídá dřívějším grafům). „Centerfoldy podle roku“ jsou teď „Modelky podle roku“, věk je „Věk při prvním výskytu“.
- Výběr roku je „první výskyt 1992–2003“ (nebo „první centerfold…“) a platí pro edici a druh výskytu, ve kterých vznikl.
- Nápověda pod grafem řekne, kolik modelek bez čísla (jen online nebo bez vydání) v grafech v čase není; grafy rozložení počítají se všemi modelkami.

## [0.97.0] – 2026-10-22

### Přidáno
- Údržba → Kontrola má vlastní soubor `kontrola.go` a víc pravidel: narození v budoucnosti, před rokem 1900 nebo po prvním vydání; úmrtí před narozením nebo před prvním vydáním; věk při prvním vydání mimo 18–45 let; výška, váha, BMI a obvody mimo běžné rozsahy, pas širší než boky nebo hrudník; Playmate roku dřív než první centerfold (nebo bez něj); dvě různá centerfoldová alba v jednom čísle; stejná fotka ve dvou albech modelky.
- „V pořádku“ (pod ⋯ nebo pravým tlačítkem na štítku): pravdivý údaj, který jen vypadá jako chyba (modelce opravdu bylo 16 let), se už nehlásí. Ukládá se mezi „netýká se“ modelky nebo alba, takže ho nese i záloha a export; „zobrazit i netýká se“ nález ukáže s ✓ a „Znovu kontrolovat“ ho vrátí.
- Štítek nálezu otevře formulář modelky přímo na záložce a poli s údajem (věk → datum narození, výška…); alba a fotky v profilu. Víc nálezů jedné modelky je na jednom řádku.

### Změněno
- Album s jednou fotkou se hlásí, jen když se jeho název podobá jinému albu modelky (překlep při přidávání); samostatné album s jednou fotkou je v pořádku.

## [0.96.0] – 2026-10-22

### Přidáno
- Statistiky: výběr platí pro všechny grafy. Vybraný rok či období (centerfold, přidání) nebo hodnota (kategorie, národnost…) zúží ostatní grafy – jasně modelky výběru, tlumeně celá sbírka a čárkovaně její křivka. Podmínky jsou štítky pod lištou (křížek odebere jednu, „Zrušit výběr“ nebo Esc všechny); grafy s osou roků sdílejí výběr roku centerfoldu.
- Nové grafy v čase: BMI a poměr pas : boky (medián a pásmo) a podíly – blond vlasy, silikonová prsa, oholené ochlupení, tetování a piercing (procento ze známých hodnot s křivkou).
- Souhrn nad grafem srovná výběr s celkem (např. „medián ve výběru 22 let (celkem 21 let)“); pruhy rozložení ukazují „výběr / celkem“.

## [0.95.0] – 2026-10-22

### Změněno
- Přehled → Statistiky jsou přehlednější: místo deseti grafů a řádku čísel je vidět jeden velký graf, vybraný z rozvinutého seznamu, a vedle něj seznam modelek. Vybraný graf si program pamatuje.
- Grafy v čase podle roku centerfoldu: počet centerfoldů (sloupce) a věk v době centerfoldu, výška, váha, hrudník, pas a boky (medián roku a pásmo prostřední poloviny modelek); přes ně bílá křivka klouzavého průměru. Přibývání sbírky po měsících za dva roky. Přepínač Vše / US / CZ.
- Klik na sloupec vybere rok, tažení myší celé období; šipky ← → výběr posouvají, se Shiftem ho rozšíří, Esc ho zruší. Seznam vpravo ukáže modelky vybraného roku nebo období (bez výběru všechny), klik otevře profil.
- Grafy rozložení (kategorie, národnosti, barva vlasů a očí, hodnocení, výskyt, fotografové) jsou pruhy; klik vybere hodnotu, „Otevřít v galerii“ ji převede na hledání.
- Tabulka Vývoj v čase odpadla – její údaje jsou teď grafy v seznamu.

## [0.94.4] – 2026-10-22

### Opraveno
- Kalendář: listování obsahem čísla na kartě už nebliká ani s grafickou akcelerací. Obrázky se střídají okamžitě, bez prolínání – průhlednostní animace nad zaoblenou kartou s posunem při najetí ve WebKitGTK blikala.

## [0.94.3] – 2026-10-22

### Opraveno
- Kalendář: listování obsahem čísla na kartě už nepoblikává. Obrázky leží po celou dobu ve vlastní vrstvě nad obálkou, která nepřijímá myš; střídání je jen zvedne navrch a prolne, nic se pod kurzorem nevkládá ani neodebírá, takže karta neztrácí najetí (posun a růžový rámeček).

## [0.94.2] – 2026-10-22

### Opraveno
- **Kalendář, listování na kartě:** když se obrázky z Disku stahovaly déle než interval střídání (typicky napoprvé), karta přeskakovala na zastaralé snímky, linka neodpovídala obrázku a obálka problikávala. Teď se každý obrázek čísla stáhne jednou a jen se prolne přes obálku; další krok začne, až je předchozí opravdu vidět, a linka se přepne zároveň s obrázkem. Původní obálka zůstává pod překryvy, odjetí myší je jen odebere.

## [0.94.1] – 2026-10-22

### Vylepšeno
- **Kalendář: listování obsahem čísla na kartě.** Když myš chvíli (půl vteřiny) zůstane na kartě čísla, střídá se na ní cover, centerfold a nejlépe hodnocená fotka z pictorialu (asi po 1,2 s, s prolnutím); bílá linka dole ukazuje, co je právě vidět. Odjetí myší vrátí původní obálku. Obsah čísla se načte až při prvním najetí a pak se pamatuje.

## [0.94.0] – 2026-10-22

### Změněno
- **Čísla a Kalendář jsou jedna část:** Čísla mají dvě zobrazení, mezi kterými se přepíná volbou **Obálky ▾ / Kalendář ▾** na začátku lišty voleb (vedle Edice a Filtrů). Obálky ukazují čísla ve sbírce jako velké dlaždice, Kalendář všechny měsíce včetně chybějících. Přepnutím zůstaneš na stejném roce, záložka Čísla svítí v obou zobrazeních a otevře naposledy zvolené. Ikona kalendáře v horní liště odpadla.

## [0.93.0] – 2026-10-22

### Přidáno
- **Výskyt modelky: v časopise, nebo jen online.** Program ho pozná sám: *v časopise* je modelka s centerfoldem, obálkou nebo albem u konkrétního čísla (měsíc nebo speciál; ročník bez měsíce jako „Cybergirl of the Year 2012“ se nepočítá), *jen online* modelka bez čísla s online kategorií (Cyber Girl, Coed, Muse, Creator), ostatní jsou *neurčené*. Výskyt je v profilu, ve Filtrech galerie (s počty), ve Statistikách (skupina Sbírka, kombinuje se s ostatními podmínkami) a v hledání `vyskyt:casopis`, `vyskyt:online`, `vyskyt:neurceno`.
- Nová kategorie **Online** pro modelky jen z internetu, které nemají jinou online kategorii (rozpozná i „Playboy Plus“, „Playboy.com“).

### Opraveno
- Statistiky, přibývání sbírky: červen a červenec měly stejnou zkratku „Čer“; teď Čvn a Čvc jako na páskách čísel.

## [0.92.2] – 2026-10-22

### Vylepšeno
- **Statistiky jako skládaný výběr:** klik (nebo Enter) na sloupec či řádek grafu přidá podmínku výběru, další kliky ho zužují – třeba Celebrita, 70. léta a černé vlasy. V jednom grafu platí jedna hodnota; klik na jinou ji vymění, na tutéž ji zruší. Všechny grafy i čísla nahoře se přepočítají: tlumeně celá sbírka, jasně výběr (každý v měřítku svého největšího sloupce, aby byl tvar vidět i u malého výběru), u řádků „výběr / celkem“ a v číslech „z 2 000“ nebo „celkem 21“.
- **Lišta výběru** ukazuje podmínky jako štítky (křížek podmínku odebere), počet modelek, „Zrušit výběr“ a „Zobrazit modelky“ s jejich titulními fotkami; klik na fotku otevře profil a „Otevřít v galerii“ převede výběr na hledání, když ho jde hledáním vyjádřit (kategorie, národnost, vlasy, oči, hodnocení, fotograf). Esc zavře fotky, další Esc zruší výběr.
- **Grafy ve skupinách** Zařazení, Vzhled a původ a Sbírka, po třech v řadě (stránka je kratší); grafy bez údajů se nezobrazují a písmo v grafech je všude stejně velké. Fotografové se nově počítají v modelkách, aby šli kombinovat s ostatními podmínkami; místo čísla „Přibylo“ je nahoře průměrné hodnocení.

## [0.92.1] – 2026-10-22

### Vylepšeno
- **Přepracované Statistiky:** nahoře pět čísel (modelky, centerfoldy, věk, národnosti, přibylo za 30 dní) a nové grafy: kategorie, centerfoldy podle desetiletí rozdělené na edice US a CZ, barva vlasů a očí, hodnocení modelek a přibývání sbírky po měsících; zůstávají věk v době centerfoldu, národnosti, fotografové a vývoj v čase.
- **Klik na sloupec ukáže modelky:** klik (nebo Enter) na sloupec či řádek grafu rozbalí pod řadou grafů titulní fotky modelek, které do něj patří, s údajem k věci (např. měsíc centerfoldu nebo věk). Klik na modelku otevře profil, „Zobrazit v galerii“ je ukáže jako hledání (u kategorií, národností, barvy vlasů a očí, hodnocení a fotografů), Esc výběr zavře. Stejně funguje číslo „Přibylo“.

## [0.92.0] – 2026-10-22

### Změněno
- **Přehled bez levého panelu:** části Přehled, Údržba, Sháním CZ a Statistiky jsou v liště nahoře přes celou šířku (jako dřív jen v úzkém okně), takže obsah pod ní má celou šířku okna.

## [0.91.0] – 2026-10-22

### Přidáno
- **Kategorie modelek** podle rozdělení na Playboy.com: Playmate měsíce, Playmate roku (s rokem), Cyber Girl a Coed (týdne, měsíce, roku), Muse, Celebrita, Modelka obálky, Jen ve speciálu a Creator. Modelka může mít kategorií víc; volí se štítky v „Upravit modelku…“ (i v okně Doplnit) a jinou hodnotu jde dopsat jako vlastní kategorii.
- **Playmate měsíce a Modelku obálky program pozná sám** z centerfoldu a obálky ve sbírce, ručně se zadávat nemusí.
- Kategorie jsou v profilu, ve filtru galerie (Filtry → Kategorie, s počty), v našeptávači a v hledání `kategorie:` (např. `kategorie:"playmate roku"`, `-kategorie:celebrita`); Údržba hlásí chybějící kategorii jen tam, kde není zapsaná ani odvozená.

### Změněno
- Pole „Role“ se jmenuje „Kategorie“. Dosavadní hodnoty zůstávají: známé názvy (i anglické, např. Cybergirl of the Month 2005) se sjednotí, ostatní zůstanou jako vlastní kategorie. Databáze ani formát exportu se nemění.

### Opraveno
- Nápověda k hledání: přebytečná tečka v příkladu „obalka:1995“.

## [0.90.4] – 2026-10-21

### Opraveno
- **Testy na čistém klonu:** zkušební databáze starších verzí (`testdata/stare-verze/*/playboy.db`) nebyly v repozitáři, protože je vynechávalo pravidlo `*.db` v `.gitignore`; test přechodu ze starších verzí proto na čistém klonu selhal. Databáze jsou teď v repozitáři. Program se nemění.

## [0.90.3] – 2026-10-21

### Dokumentace
- **Číslování po 1.0.0:** téma z plánu zvyšuje druhé číslo (1.1, 1.2 … 1.10), každý hotový krok a oprava v tématu poslední číslo (1.3.0, 1.3.1, 1.3.2…), stejně jako v alfě. Program se nemění.

## [0.90.2] – 2026-10-21

### Dokumentace
- **Plán po 1.0.0 v menších krocích:** verze 1.1–1.4 rozdělené na osm menších verzí (1.1–1.8, každá 2–4 kroky a zhruba 1–3 dny práce) s přehledovou tabulkou a závislostmi; „mám PDF“ a hodnocení kolečkem myši v rezervě. Program se nemění.

## [0.90.1] – 2026-10-21

### Dokumentace
- **Plán po betě v `ROADMAP.md`:** pravidlo pro vydání 1.0.0 (14 dní používání bety bez nové chyby), způsob vydávání po 1.0.0 a podrobně rozpracované verze 1.1 (Google Disk v aplikaci), 1.2 (každodenní práce), 1.3 (velká sbírka, náhledy na disku) a 1.4 (editor textů). Program se nemění.

## [0.90.0] – 2026-10-21 – beta

První beta. Od této verze do 1.0.0 se opravují jen chyby: funkce, texty, schéma databáze (úprava č. 11)
a formát exportu (verze 7) jsou zmrazené. Opravy vycházejí jako 0.90.1, 0.90.2… Instalace na čistém účtu
Fedory, přenos dat, obnovení ze zálohy a práce bez připojení jsou ověřené podle testovacího scénáře
v `ROADMAP.md`.

### Co přinesla alfa (0.50–0.51)
- **Rychlost:** databáze v režimu WAL (ukládání zhruba 40× rychlejší), rychlejší Přehled, kalendář a statistiky, obrázky se při rychlém rolování načítají postupně; Nejlepší na sbírce s 2 000 modelkami 14,6 s → 0,4 s.
- **Edice:** americká měsíční řada 12/1953–03/2020, česká od 07/2011, nevydané číslo 03/1955; měsíce mimo řadu se v kalendáři, ročníku ani mapách nepočítají jako chybějící.
- **Ovládání:** jednotné kontextové nabídky, ovládání klávesnicí (mapy edic, Vývoj v čase, srdíčka 0–5), návrat na původní místo po Zpět, úprava pro úzké okno.
- **Spolehlivost:** bezpečné obnovení ze zálohy, ověřený přechod z databází a exportů deseti starších verzí, odolnost bez připojení („Nenačteno“, hlášky o výpadku a návratu připojení).
- **Zabezpečení a údržba:** revize zabezpečení, Content-Security-Policy, aktualizované závislosti, úklid kódu a stylů.
- **Texty a instalace:** kontrola všech textů, srozumitelné chybové hlášky, postup instalace na čistou Fedoru, nová ikona programu, známá omezení v README.

## [0.51.22] – 2026-10-20

### Přidáno
- **Známá omezení v README:** fotky jen z Disku a s připojením, heslo nešifruje databázi, ověřeno na Fedoře, jeden počítač.
- **Testovací scénář bety** v `ROADMAP.md`: kontrolní seznam pro instalaci na čistém účtu, přenos dat, obnovení ze zálohy a práci bez připojení.

## [0.51.21] – 2026-10-20

### Změněno
- **Nová ikona programu:** Pin-up dívka v kostkované košili a s šátkem ve vlasech v retro rámečku. Po `./instalovat.sh` se ukáže v nabídce aplikací i v okně (někdy až po odhlášení a přihlášení). Instalace teď ukládá ikonu ve velikostech 256 a 512 px a odstraní SVG ikonu, kterou instalovala předchozí verze.

## [0.51.20] – 2026-10-20

### Vylepšeno
- **Ikona i v okně:** Ikonu programu má i běžící okno (přepínání Alt+Tab, panel) a okno se spolehlivě spáruje s položkou v nabídce aplikací. V nabídce je ikona ostrá v každé velikosti a program jde najít i hledáním slov „katalog“, „sbírka“ nebo „časopis“.
- **Srozumitelné chybové hlášky:** Když se něco nepovede, hláška místo interního názvu funkce říká, co se dělo, třeba „Chyba (přesun fotek): …“.
- **Pojistka zabezpečení:** Okno programu spustí jen vlastní skripty programu (Content-Security-Policy).

### Opraveno
- Ročník a stránka Čísla počítají do „X z Y“ jen čísla, která v měsíční řadě edice mohla vyjít, stejně jako kalendář (dřív třeba „11 z 3“ u roku 2020).
- Souhrn v Údržbě: čtyřmístná čísla („2000 z 2000“) se nezalamují a pruhy začínají pod sebou.
- Přehled prázdné sbírky neukazuje „100 % s úplnými údaji“ u nula modelek.
- Drobnosti: „Přidat modelku…“ s trojtečkou jako ostatní položky, které otevírají okno; v okně Adresa obrázků je mezera mezi vysvětlením a polem.

## [0.51.19] – 2026-10-20

### Změněno
- **Nová ikona programu:** Místo výchozí ikony Wails má program vlastní ikonu ve svých barvách – obálku časopisu s růžovým záhlavím a srdíčkem na tmavém podkladu. Po `./instalovat.sh` se ukáže v nabídce aplikací (někdy až po odhlášení a přihlášení).

## [0.51.18] – 2026-10-20

### Vylepšeno
- **Instalace na čistou Fedoru:** README má postup od prázdného systému (balíčky, Wails, stažení programu). Když chybí Wails, Go, npm nebo knihovny WebKitGTK, `instalovat.sh` vypíše, co přesně doinstalovat, místo nejasné chyby.

### Opraveno
- Sestavení už nemění soubory v repozitáři (vygenerované vazby na backend), takže další `git pull` neskončí hláškou o místních změnách.
- Po spuštění se kolem seznamu modelek a stěny centerfoldů neukazuje modrý rámeček fokusu.

## [0.51.17] – 2026-10-20

### Opraveno
- **Texty:** Opravené překlepy a skloňování („sháněná čísla“, „alba“, počet modelek ve Vývoji v čase, hlášky importu a Přehledu) a uvozovky.
- **Zastaralé popisy:** Nápověda a hlášky odpovídají současnému chování: co import maže (jen údaj s hodnotou „-“), tvar vydání s příponou edice, stav výtisku jen u české edice, zálohy před každou hromadnou změnou, nabídka ⋯ u fotky, tlačítko „Uložit a další“ a nápověda k hledání.

### Změněno
- **Jednotné názvy:** „Otevřít číslo“ místo „Otevřít vydání“, „Přidat fotky nebo album…“, „Desetiletí“ v našeptávači, „Sháním CZ“ v Přehledu. Položky nabídek, které otevírají okno, končí trojtečkou. Texty oslovují jednotně tykáním.

## [0.51.16] – 2026-10-20

### Vylepšeno
- **„Co je nového“ po větší aktualizaci:** Když od naposledy viděné verze přibylo víc verzí, jsou celé vidět jen tři nejnovější a starší změny jsou ve sbaleném oddílu „Starší změny – N verzí“, který jde rozbalit.

## [0.51.15] – 2026-10-20

### Změněno
- Úklid před betou: odstraněno 61 nepoužívaných pravidel stylů (staré karty Údržby, dřívější tabulky statistik a Přehledu), nepoužívané funkce a soubor `build/README.md` ze šablony Wails. Vzhled se nemění (snímky všech pohledů před a po úklidu jsou stejné).

## [0.51.14] – 2026-10-20

### Změněno
- **Aktualizované knihovny:** opravné verze knihoven Go pro síť, systém, text a šifrování (golang.org/x/net, sys, text, crypto) a několika dalších. Sestavení používá Go 1.26.10 s opravami bezpečnosti standardní knihovny (na Fedoře s balíčkovým Go stačí `sudo dnf upgrade golang`). Kontrola typů běží na TypeScriptu 5.9. Rozhraní za běhu žádnou knihovnu z npm nepoužívá a `npm audit` nenašel nic. Wails zůstává na ověřené verzi 2.16.0.

## [0.51.13] – 2026-10-20

### Vylepšeno
- **Bez připojení k internetu:** Fotka, která se nenačetla, ukazuje zástupný obrázek „Nenačteno“ místo „Bez fotky“ (ten zůstává pro modelku, která titulní fotku nemá). Výpadek připojení program ohlásí a po jeho návratu se nenačtené fotky načtou samy, bez obnovování stránky.

## [0.51.12] – 2026-10-20

### Opraveno (revize zabezpečení)
- Revize zabezpečení nenašla žádnou zranitelnost: zkouška s útočným textem ve všech údajích (jména, texty alb, články, odkazy, názvy výběrů…) v žádném okně nic nespustila, z odkazů modelky se otevírají jen adresy https, heslo je uložené jen jako otisk (PBKDF2 se solí) a dotazy do databáze dostávají hodnoty jako parametry.
- Drobnosti z revize: nápověda prázdného políčka v kalendáři je ošetřená stejně jako ostatní a výřez titulní fotky s neplatnou hodnotou z ručně psaného importu („.nan“) se nastaví na výchozí.

## [0.51.11] – 2026-10-20

### Opraveno
- Záloha, která se nedokončila (například na plném disku), už nezůstane ve složce záloh jako nedokončený soubor, který by se v seznamu tvářil jako záloha.

## [0.51.10] – 2026-10-20

### Vylepšeno (úzké okno a klávesnice)
- **Přehled v úzkém okně** (do 900 px): levý panel Sbírka je řádek částí nad obsahem, ne sloupec s prázdným místem pod sebou.
- **Mapy edic klávesnicí:** Do každé mapy vede jeden Tab, šipky se pohybují po měsících (←→) a rocích (↑↓) a přeskakují měsíce, které nevyšly; Home a End skočí na první a poslední číslo, Enter číslo otevře, klávesa nabídky (Shift+F10) nabídne jeho stav.
- **Vývoj v čase klávesnicí:** Řádky tabulky jdou zaměřit Tabem, Enter ukáže graf a fokus zůstane na řádku.
- **Fokus při přechodech:** Po otevření profilu nebo čísla klávesnicí jde další Tab rovnou do něj; Zpět vrátí fokus na kartu nebo dlaždici, ze které se odešlo.
- **Srdíčka klávesami:** Zaměřené kartě modelky nebo dlaždici fotky dají klávesy 1–5 srdíčka, 0 je zruší. Srdíčka na kartách a dlaždicích už Tab neprochází (každá karta měla pět zastávek navíc), stejně jako svislý rejstřík písmen a roků u okraje.

## [0.51.9] – 2026-10-20

### Vylepšeno (zátěžová zkouška: 2 000 modelek, 64 000 fotek)
- **Nejlepší s desítkami tisíc fotek:** Mozaika se vykresluje po úrovních srdíček a po dávkách 300 fotek; další dávka se přidá sama, když se konec úrovně blíží k oknu. Skok na úroveň v liště ukáže její začátek hned. Při rolování nahoru se konec předchozí úrovně sám nedoplňuje (obsah by poskočil), je tam tlačítko „Zobrazit další fotky (N)“. S 28 000 fotkami se Nejlepší dřív vykreslovaly 14,6 s a okno na 13,5 s zamrzlo; teď 0,4 s. Ctrl+A vybere vykreslené fotky.
- **Karty Modelek a plakáty na stěně Centerfoldů** se mimo okno nevykreslují: 2 000 karet se ukáže za 0,3 s místo 1 s, stěna za 0,4 s místo 0,9 s a obojí plynuleji roluje. Vzhled a efekty při najetí myší zůstávají stejné.
- Přehled s velkou sbírkou se otevře za 0,4 s (dřív 2,6 s, zdržovaly ho prvky Nejlepších, které zůstávaly ve stránce).

## [0.51.8] – 2026-10-20

### Změněno
- **Měsíční řady edic:** Program zná, kdy která edice vycházela jako měsíčník. Americká od 12/1953 (první číslo s Marilyn Monroe) do 03/2020 (Spring 2020, poslední pravidelné číslo); čísla od roku 2025 (ročenka, čtvrtletník) se evidují jako speciály. Česká od 07/2011. Měsíce mimo řadu se v kalendáři a na stránce ročníku ukazují jako „nevyšlo“ a nepočítají se jako chybějící; počet „x z N“ u roku odpovídá skutečnému počtu čísel (1953: 1, 2020: 3).
- **Mapa americké edice** v Přehledu ukazuje celou měsíční řadu 1953–2020, ne jen roky, ze kterých máš čísla, a „Čísla US“ počítají z čísel, která opravdu vyšla.

## [0.51.7] – 2026-10-20

### Opraveno
- **Březen 1955 (US) nevyšel:** Americké číslo z března 1955 se už neukazuje jako chybějící. V kalendáři a na stránce ročníku je místo něj tlumené políčko „nevyšlo“, na které nejde kliknout, v mapě americké edice prázdné místo, které se nepočítá mezi chybějící čísla. Ročník 1955 má 11 čísel („x z 11“ v kalendáři, na stránce Čísla i ročníku).

## [0.51.6] – 2026-10-20

### Opraveno
- **Mapa české edice začíná prvním číslem 07/2011** místo roku 1991. Měsíce roku 2011 před prvním číslem jsou v mapě prázdné, nedají se otevřít ani označit a nepočítají se mezi chybějící čísla; „Výtisky CZ“ tak počítají jen čísla, která opravdu vyšla. Pokud by sbírka obsahovala české číslo z dřívější doby, mapa začne od něj.

## [0.51.5] – 2026-10-20

### Opraveno (revize změn od verze 0.33.17 – rozhraní)
- **Titulní fotka ze sdíleného alba:** „Nastavit jako titulní fotku“ v profilu další modelky sdíleného alba (i v prohlížeči otevřeném z profilu) nastavovala titulní fotku hlavní modelce alba. Teď ji dostane modelka, jejíž profil je otevřený.
- **Ročník:** Pravé tlačítko na měsíci na stránce ročníku ukazovalo nabídku celého ročníku a „Upravit číslo…“ otevřelo úpravu roku. Teď je to nabídka toho čísla; „Upravit číslo…“ se na stránce ročníku a fotografa nenabízí.
- **Nabídka čísla** se neotevře, když mezitím přejdeš jinam (dřív mohla po načtení dat vyskočit nad jiným přehledem); na stránce Čísla se už kvůli ní znovu nenačítá kalendář. U americké edice jde zrušit dříve nastavený stav „mám výtisk“ nebo „sháním“.
- **Volné místo v profilu** už nenabízí „Upravit výřez titulní fotky“ – upravovala se neviditelná karta v galerii (výřez zůstává na kartě modelky).
- **Údržba:**
  - Pravé tlačítko na „Doplňovat postupně“ nabízelo „netýká se“ pro první modelku fronty.
  - „Netýká se“ u čísla, které máš („mám výtisk“) nebo sháníš, by ten stav přepsalo na „nezajímá mě“; teď se stav nemění a program to oznámí.
  - Počet u filtru „Vše“ nepočítá modelky, kterým zbývají jen úkoly „netýká se“.
  - Po kliknutí na filtr zůstane na filtru fokus klávesnice.
  - Odkazy z úvodu do Údržby začínají zase od prvních 60 řádků.
- **Vývoj v čase:** Při rychlém přepnutí US/CZ se už nevykreslí starší odpověď pod nadpisem jiné edice.
- Fotka, která se nenačetla, se při rolování znovu nestahuje.

## [0.51.4] – 2026-10-20

### Opraveno (revize změn od verze 0.33.17 – databáze)
- **Obnovení ze zálohy v režimu jen pro čtení:** Když program běžel jen pro čtení (poškozená databáze) a po pádu zůstal vedle databáze deník změn, obnovení ze zálohy se pokaždé odmítlo a navíc databázi otevřelo znovu pro zápis. Teď se deník přenese zvláštním spojením a záloha se obnoví; když obnovení selže, databáze se vrátí do původního režimu včetně „jen pro čtení“.
- **Obnovení během importu** se odmítne, místo aby smazalo deník, do kterého import právě zapisuje.
- **Bez režimu WAL** (souborový systém, který ho neumí) se databáze otevře s plně bezpečným zápisem na disk.

## [0.51.3] – 2026-10-20

### Opraveno
- **Postupné načítání i v Nejlepších a v profilu:** Mozaika Nejlepších a fotky v albech profilu modelky se načítají stejně jako karty Modelek, stěna centerfoldů a Čísla: fotky se začnou stahovat asi dvě obrazovky dopředu a ty, které odrolují dřív, než se načetly, se zruší. Mozaika Nejlepších si poměr stran fotky zjistí, až se fotka opravdu načte.

## [0.51.2] – 2026-10-20

### Opraveno
- **Prázdné plakáty a obálky při rychlém rolování Centerfoldů a Čísel:** Stěna centerfoldů a stránka Čísla používají stejné postupné načítání jako karty Modelek (0.51.1): fotky se začnou stahovat asi dvě obrazovky dopředu a ty, které odrolují dřív, než se načetly, se zruší. V měření se simulovaně pomalou sítí se stěna centerfoldů po rychlém rolování zaplnila za 0,7 s místo 2,5 s.

## [0.51.1] – 2026-10-19

### Opraveno
- **Prázdné karty při rychlém rolování Modelek:** Fotky na kartách se teď načítají vlastním postupným načítáním: začínají asi dvě obrazovky před zobrazenou částí, a když karta odroluje dřív, než se fotka načetla, její stahování se zruší. Fotky na obrazovce tak nečekají ve frontě za desítkami fotek, které už jsou pryč. V měření se simulovaně pomalou sítí se karty po rychlém rolování zaplnily za 0,7 s místo 3,6 s a stáhlo se čtvrtinové množství fotek.

## [0.51.0] – 2026-10-19

### Vylepšeno
- **Rychlejší ukládání:** Databáze běží v režimu WAL – změny se připisují do deníku vedle databáze (`playboy.db-wal`) a na disk se srovnají najednou. Uložení srdíčka nebo údaje už nečeká na zápis na disk (v měření zhruba 40× rychleji) a čtení se zápisem se navzájem neblokují, ani když běží kontrola souborů na pozadí. Při prvním spuštění se databáze do režimu přepne sama; uložená data přežijí i pád programu.
- **Rychlejší Přehled, kalendář a statistiky:** Kalendář, Přehled a seznam vydání modelek se počítají po albech místo po jednotlivých fotkách (desetkrát méně řádků) a seznam tagů pro našeptávání čte jen tagy. Na sbírce o 500 modelkách a 20 000 fotkách: kalendář 51 → 9 ms, Přehled 133 → 60 ms, statistiky 48 → 11 ms, tagy 44 → 0,1 ms, načtení modelek 48 → 26 ms. Výsledky jsou stejné jako dřív.

### Opraveno
- Obnovení ze zálohy nejdřív uzavře databázi a přenese deník změn, aby se do obnovené databáze nic ze staré nepřimíchalo.

## [0.50.1] – 2026-10-19

### Přidáno
- Licence: zdrojový kód je pod licencí MIT (soubor `LICENSE`, oddíl Licence v README). Ochranná známka Playboy ani fotky a obsah sbírky pod licenci nespadají.

## [0.50.0] – 2026-10-18 – alfa

První alfa. Program je použitelný na skutečné sbírce; od této verze do 1.0.0 přibývají jen opravy
a doladění rozhraní. Schéma databáze (úprava č. 11) a formát exportu (verze 7) jsou zmrazené: databáze
ani exportované soubory se už do vydané verze nezmění. Chyby z alfy se opravují ve verzích 0.50.1, 0.50.2…

### Co alfa obsahuje
- **Modelky, alba a fotky:** profil s údaji a centerfoldy, sdílená alba, spojené plakáty, prohlížeč fotek se
  slideshow, lupou a srdíčky, výběr více fotek, vlastní výběry, odebrání s možností vrátit.
- **Čísla časopisu:** edice US a CZ, speciály, kalendář, stránka čísla s obsahem podle stran, články a skeny
  stran, ročníky a fotografové; výtisky české edice (mám výtisk, sháním).
- **Přehled:** mapy edic, Údržba jako fronta úkolů, Sháním CZ, Statistiky a vývoj modelek v čase.
- **Hledání:** rychlé výsledky, cílené hledání, rozsahy, vylučování, překlepy a fulltext v textech.
- **Data:** export a import YAML a Markdownu, denní zálohy a obnovení, zámek heslem, instalace do nabídky
  aplikací.

### Změněno
- Test hlídá zmrazení schématu databáze a formátu exportu.
- README, ROADMAP, PLAN a popis exportu odpovídají alfě: co program umí, číslování alfa 0.50.x, beta 0.90.x
  a 1.0.0, plán po vydání.

## [0.34.7] – 2026-10-18

### Změněno
- Kontextové nabídky mají jedna pravidla: otevřít → upravit → přidat → uspořádat → smazat (vždy poslední). Z nabídek obsahu zmizely Zpět, Obnovit a Zkontrolovat soubory (zůstávají v hlavním ⋯) i položky, které jsou tlačítkem hned vedle.
- Fotka v albu nabízí jen akce fotky. Akce alba jsou pod ⋯ v hlavičce alba, pravým tlačítkem mimo fotky nebo položkou „Album …“ v nabídce fotky. Z nabídky alba zmizely Otevřít vydání a Upravit modelku.
- Číslo časopisu má všude stejnou nabídku (kalendář, Čísla, mapa v Přehledu, ročník, prázdné políčko). Nahoře je název čísla, přidat se nabízí jen to, co číslu chybí, a Upravit číslo… je všude. Současný stav čísla má ✓ a druhý klik ho zruší; „Zrušit označení“ zmizelo.
- Nový speciál a pictorial k ročníku jsou v nabídce na nadpisu roku v kalendáři.
- Karta modelky nabízí i Otevřít profil a Sloučit s jinou modelkou…
- Volné místo v profilu nabízí slideshow modelky, výřez titulní fotky, sloučení a smazání. Volné místo na stránce čísla nabízí slideshow a Upravit číslo…
- Nastavit jako titulní fotku jde z každé fotky modelky (i v prohlížeči, v Nejlepších a na stěně centerfoldů).
- Oddíl „Údržba“ v hlavním ⋯ se jmenuje „Soubory a mezipaměť“, aby se nepletl s Údržbou v Přehledu.

## [0.34.6] – 2026-10-18

### Změněno
- Údržba je jedna fronta úkolů místo záložek Souhrn, Modelky, Čísla a Ke kontrole. Modelky, čísla i údaje ke kontrole jsou v jednom seznamu, seřazené podle toho, kolik toho chybí. Nahoře je stručný souhrn pokroku a filtry s počty (Titulní fotka, Centerfold, Hodnocení, Údaje, Texty alb, Vydání alb, Cover čísla, Centerfold čísla, Kontrola).
- Na řádku jsou štítky toho, co chybí. Klik na štítek otevře právě ten údaj, „Doplnit“ otevře první z nich. „Doplňovat postupně“ prochází modelky s „Uložit a další“.
- Pod ⋯ na řádku je „netýká se“ pro každý úkol, okno „Doplnit modelku“ se vším, co jí chybí, a profil.
- Řádky „Co zbývá doplnit“ na úvodu otevřou Údržbu rovnou s filtrem na danou položku.

## [0.34.5] – 2026-10-18

### Vylepšeno
- **Vývoj v čase – BMI a poměr pas : boky:** Dva odvozené řádky (s popiskem „odvozeno“): BMI z výšky a váhy a poměr pasu a boků (na dvě desetinná místa); počítají se jen u modelek, které mají oba údaje.
- **Vývoj v čase – úplnost dat:** Nový sloupec **Úplnost** u každého údaje: pruh a procento modelek s centerfoldem v edici, které údaj mají. Odkaz **doplnit N →** otevře formulář první modelky, které údaj chybí, rovnou v daném poli, a tlačítkem **Uložit a další** projde všechny ostatní.

## [0.34.4] – 2026-10-18

### Přidáno
- **Vývoj v čase ve Statistikách:** Tabulka údajů po desetiletích podle roku centerfoldu modelky – medián věku v době centerfoldu, výšky, váhy, hrudníku, pasu a boků a podíl blond vlasů, oholeného ochlupení, silikonových prsou, tetování a piercingu. Pod každou hodnotou je počet modelek se známým údajem; období s méně než pěti modelkami je tlumené. Sytost buňky ukazuje, kde je hodnota v řádku nejvyšší. Klik na řádek ukáže pod tabulkou graf: u číselných údajů čáru mediánu po pětiletích s pásmem prostřední poloviny modelek, u podílů sloupce po desetiletích rozdělené na sto procent; po najetí myší bublina s hodnotou. Přepínač US/CZ vybere edici (výchozí US). Barva vlasů z volného textu se řadí do skupin Blond, Hnědé, Černé, Zrzavé a Jiné.

## [0.34.3] – 2026-10-18

### Vylepšeno
- **Úvod Přehledu:** Pod mapami edic je celý seznam **Co zbývá doplnit** s pruhy a tlačítky „doplnit“ (místo karty se třemi úkoly), dva grafy – **Výtisky CZ po letech** a **Centerfoldy podle desetiletí** (s bublinou po najetí myší) – a naposledy přidané modelky v jednom řádku.

## [0.34.2] – 2026-10-18

### Vylepšeno
- **Nový Přehled:** Levý panel má čtyři části místo šesti: **Přehled**, **Údržba**, **Sháním CZ** a **Statistiky**.
  - **Přehled (úvod):** hlavní čísla (modelky, alba, čísla US, výtisky CZ), mapa **české edice** jako sbírky výtisků od roku 1991 (mám výtisk, sháním, nezajímá mě, chybí) a mapa **americké edice** jako archivu dat (kompletní číslo má cover, centerfold i pictorial, částečné jen něco z toho). Políčko je jedno číslo: klik ho otevře, prázdné nabídne přidání, pravým tlačítkem se nastaví stav. Dole tři nejdůležitější úkoly k doplnění a naposledy přidané modelky.
  - **Údržba:** dosavadní Souhrn, Modelky, Vydání a Ke kontrole pod jednou položkou se záložkami nahoře.
  - **Sháním CZ:** shánená čísla české edice po letech s poznámkou; klik nabídne „Mám výtisk“ nebo „Už nesháním“, **Kopírovat seznam** dá seznam do schránky jako text.
  - Část Ročníky je nahrazená mapami.
- **Výtisky jen u české edice:** „Mám výtisk“ a „Sháním“ se nabízejí jen u čísel české edice (v kalendáři, na stránce čísla, v okně Upravit číslo); americká edice nabízí jen „Nezajímá mě“. Už nastavený stav u amerického čísla zůstává.

## [0.34.1] – 2026-10-17

### Změněno
- **Nadpisy zpět v písmu aplikace:** Patkové písmo Bodoni Moda z verze 0.34.0 je odstraněné; jména modelek, názvy čísel, alba a roky mají opět původní střídmý vzhled. Vložené soubory písma jsou z aplikace odebrané.

## [0.34.0] – 2026-10-17

### Vylepšeno
- **Patkové písmo nadpisů jako v časopise:** Jména modelek (na kartách, na stěně centerfoldů, v profilu), názvy čísel a fotografů, nadpisy alb, názvy článků, roky v Číslech, Kalendáři a na stěně a velké nadpisy oken jsou v kontrastním písmu Bodoni Moda; roky kurzívou. Drobné popisky, tlačítka a běžný text zůstávají v písmu aplikace. Písmo je vložené přímo do aplikace (licence SIL Open Font License), takže funguje bez internetu, a má plnou češtinu.

## [0.33.18] – 2026-10-17

### Opraveno
- **Poblikávání okna při načítání karet a kontextové nabídky:** Ve WebKitGTK prvek s animací průhlednosti dostane na dobu animace vlastní vrstvu a po jejím skončení se vrací do stránky; na některých grafikách přitom obsah na okamžik zmizí. Fotky na kartách se proto znovu ukazují hned (bez plynulého objevení z verze 0.33.14), obrysy při načítání a prázdné stavy jsou bez úvodní animace a nabídky, panel Filtry, výsledky hledání a přehled zkratek zůstávají ve vlastní vrstvě trvale, takže se po animaci otevření už nepřepínají.

## [0.33.17] – 2026-10-17

### Opraveno (revize změn od verze 0.32.3)
- **Stejné hledání ve všech přehledech:** Centerfoldy, Nejlepší, Čísla, Kalendář i rychlé výsledky teď rozumí cíleným slovům stejně jako hledání modelek: `rok:1970-1979`, `rok:>=1990`, `hodnoceni:>=4`, `fotograf:`, `jmeno:`, vylučování `-1975`. Dřív stěna centerfoldů cílené pole ignorovala (`-tag:x` vyřadilo vše s písmenem x) a Kalendář syntaxi neznal vůbec. Údaj, který přehled nemá (vlasy u centerfoldů), hledání neomezuje.
- **Překlepy jen tam, kde dávají smysl:** Tolerance překlepů se už neuplatní u čísel (`1975` nenajde 1976) ani u vylučovaných slov (`-anna` nevyloučí Anju); u cíleného jména (`-jmeno:Pamella`) zůstává.
- **Rychlé výsledky:** vylučovaná slova platí i tam (`anna -novakova`), Esc zavře výsledky i tehdy, když hledání ještě nedoběhlo, hodnota s mezerou se vloží v uvozovkách (`role:"playmate měsíce"`) a u nabídek hodnot už není dvakrát počet („1 1 modelka“).
- **Hledání modelek:** `tetovani:no` a `piercing:no` už nenajdou všechny, `rok:197` najde celá sedmdesátá léta, obrácený rozsah `rok:1979-1970` funguje a rozepsaná čárka (`jmeno:anna,`) nevymaže výsledky.
- **Hledání v textech:** Úprava schématu č. 11 přestaví fulltextový index: hromadná úprava tisíců alb trvala sekundy (každá změna procházela celý index), teď zlomek sekundy. Slovo „clanek“ už nenajde všechny články, slova s pomlčkou (`jean-luc`) se najdou, alba bez popisu se indexují stejně ve starých i nových databázích, článek se najde i podle jména připojené modelky a vylučované slovo (`monte -anderson`) článek vyřadí.
- **Zrušit filtry** ruší filtry jen v přehledu, kde se začalo; rychlé přepnutí na jiný přehled už nesmaže jeho filtry. Panel Filtry jde ovládat klávesnicí (fokus na zvolené volbě, Tab zůstává v panelu). Hláška u filtru srdíček spolu s dalším filtrem je „Nic nenalezeno“ a v Nejlepších se při zvoleném výběru neukazuje nesmyslné „Srdíčka: vše“.
- **Přehled zkratek** opravdu zastaví klávesy pod sebou (Enter neklikne na tlačítko za panelem, šipky nelistují čtečkou, Esc nezavře zároveň panel Filtry), Tab zůstává v panelu a po zavření se fokus vrátí.
- Rejstřík u pravého okraje v nejužším okně nepřekrývá řádek voleb; skleněné panely mají rozmazání i ve starších verzích WebKitGTK; plynulé objevování fotek nezávisí na podpoře vlastnosti `loading`.

## [0.33.16] – 2026-10-17

### Opraveno
- **Hlavička v úzkém okně:** Lišta voleb pod hledáním se pod šířkou zhruba 750 px překrývala s ikonami vpravo. Teď se postupně zhušťuje: pod 860 px zmizí počet položek (zůstává v popisku záložky), pod 760 px slovo Filtry (zůstane ikona s odznakem) a pod 620 px jde lišta voleb na vlastní řádek pod záložky, kde se počet zase ukáže. V nejužším okně (pod 400 px) se ikony vpravo přiblíží, aby se vešly vedle záložek.

## [0.33.15] – 2026-10-17

### Vylepšeno
- **Přehled klávesových zkratek:** Klávesa `?` kdekoli otevře skleněný panel se všemi zkratkami po částech (Kdekoli, Výsledky hledání, Profil modelky, Výběr fotek, Prohlížeč fotek, Čtečka stran). Funguje i v prohlížeči fotek a ve čtečce stran; jejich část je pak první a zvýrazněná. Zavře se klávesou `?`, `Esc` nebo klikem vedle; tlačítko **Celá nápověda** otevře podrobnou nápovědu. V nabídce ⋯ přibyla položka **Klávesové zkratky (?)**, nápověda zůstává pod položkou Nápověda.

## [0.33.14] – 2026-10-17

### Vylepšeno
- **Načítání bez prázdné plochy:** Při prvním otevření Modelek, Centerfoldů, Čísel, Kalendáře a Nejlepších jsou místo prázdné plochy šedé obrysy karet s jemnou vlnou; v profilu jiné modelky se místo alb předchozí modelky do načtení ukážou obrysy alb.
- **Fotky se plynule objeví:** Náhledy na kartách a dlaždicích se po načtení plynule zviditelní místo postupného vykreslování po řádcích; už jednou načtená fotka (například po změně filtru) se ukáže hned. Při zapnutém omezení pohybu v systému se vlna i přechod vynechají.

## [0.33.13] – 2026-10-17

### Vylepšeno
- **Prázdné stavy ve všech přehledech** mají stejný vzhled jako profil bez alb: vějíř skleněných karet s ikonou podle situace, tenký nadpis, krátké vysvětlení a tlačítko, kde dává smysl.
  - **Nic nenalezeno** (Modelky, Centerfoldy, Čísla, Kalendář, Nejlepší): lupa a tlačítko **Zrušit hledání a filtry**, které smaže hledaný text a vypne všechny zapnuté filtry.
  - **Modelky podle srdíček** (žádná s ♥ N+, vše ohodnoceno): srdce a stejné tlačítko pro zrušení filtrů.
  - **Prázdná sbírka nebo edice** (Centerfoldy, Čísla, Kalendář): tlačítko **+ Přidat…** otevře nabídku přidání; u modelek tlačítko **+ Přidat modelku**.
  - **Nejlepší:** prázdný výběr (hvězda) a žádné fotky s daným počtem srdíček (srdce).
  - **Stránka čísla** bez alb a **fotograf** bez alb.

## [0.33.12] – 2026-10-17

### Vylepšeno
- **Profil modelky bez alb** místo holé věty ukazuje vějíř tří skleněných karet (přední s růžovým nádechem a ikonou fotky), tenký nadpis „Zatím žádná alba“ (nebo „Žádná další alba“, když má modelka jen centerfoldy), krátké vysvětlení a růžové tlačítko **+ Přidat fotky**, které otevře okno přidání alba. Prázdný stav je připravený i pro další stránky (`ui/prazdno.js`).

## [0.33.11] – 2026-10-17

### Vylepšeno
- Posuvníky v celém programu jsou tenký průsvitný proužek bez dráhy a šipek; po najetí myší zesílí a zesvětlí, při tažení zrůžoví. Boční panel čísla a pás náhledů ve čtečce stran už neukazují systémový šedý posuvník.

## [0.33.10] – 2026-10-17

### Vylepšeno
- Růžový rámeček mají i okna **Přidat cover / Upravit cover**, **Číslo časopisu** a **Nová modelka**, stejně jako ostatní okna, která něco mění (album, modelka, Doplnit modelku, článek).

## [0.33.9] – 2026-10-17

### Vylepšeno
- Nabídky, panel Filtry a výsledky hledání se otevírají krátkým zjemněním a zvětšením z 98 % místo okamžitého naskočení. Při zapnutém omezení pohybu v systému se animace vynechá.

## [0.33.8] – 2026-10-17

### Vylepšeno
- Skleněný vzhled i u zbývajících plovoucích prvků: oznámení dole (s možností Vrátit), bublina u grafů ve Statistikách a panel úpravy výřezu na dlaždici mají stejné průsvitné rozmazané pozadí jako nabídky, panel Filtry a výsledky hledání.

### Opraveno
- Velmi krátký pruh v žebříčku Statistik (fotograf nebo národnost s malým počtem) se vykreslil s chybou; teď je z něj zaoblený konec.

## [0.33.7] – 2026-10-17

### Vylepšeno
- Rychlé výsledky pod hledáním mají průsvitné skleněné pozadí jako nabídky a panel Filtry; stránka pod nimi dál ztmavne.

## [0.33.6] – 2026-10-17

### Opraveno
- Panel **Filtry** se otevírá uprostřed pod lištou voleb (pod hledáním), ne pod tlačítkem Filtry.

## [0.33.5] – 2026-10-17

### Vylepšeno
- **Přehlednější lišta voleb pod hledáním:** Místo řady tlačítek „Srdíčka: vše ▾ · Edice: vše ▾ · Role: vše ▾“ je v liště jen řazení (ikona ⇅ a hodnota), tlačítko **Filtry** s odznakem počtu zapnutých filtrů a zapnuté filtry jako malé štítky s ×. Filtry otevřou průsvitný panel se všemi filtry jako řádky pilulek, počtem nalezených položek a volbou **Zrušit filtry**; panel zůstává otevřený, dokud se nezavře klikem mimo nebo Esc. Lišta má stejnou šířku bez ohledu na počet filtrů, na užším okně se štítky skryjí a zůstane odznak.
- Povinné volby (edice u Čísel a Kalendáře, srdíčka v Nejlepších) zůstávají rozbalovacími tlačítky. **Výběr** v Nejlepších ukazuje bez zvoleného výběru jen „Výběr ▾“ místo „Výběr: —“ a slideshow spouští ikona ▶.

## [0.33.4] – 2026-10-17

### Vylepšeno
- **Rozšířené řazení a filtrování u Modelek a Centerfoldů:**
  - **Modelky:** V nabídce `Řazení` přibyly samostatné volby `Podle srdíček` a `Podle fotek` (včetně odpovídající levé lišty částí) a filtr `Srdíčka` při řazení `A–Z` již nečekaně neruší abecední pořadí. V nabídce `Srdíčka` přibyl filtr `Bez ♥` (nehodnocené modelky) a v liště voleb přibyly rychlé filtry `Edice` (`vše` | `US` | `CZ`) a `Role` (dynamicky podle rolí ve sbírce s počty modelek).
  - **Centerfoldy:** V nabídce `Řazení` přibyly volby `Od nejstarších`, `Od nejnovějších` (obě se seskupením po dekádách a časovou lištou) a `Podle srdíček`. V liště voleb přibyly filtry `Srdíčka` (`vše`, `♥ 1+` až `♥ 5`, `Bez ♥`) a `Edice` (`vše` | `US` | `CZ`).

## [0.33.3] – 2026-10-17

### Vylepšeno
- **Sjednocené zvýraznění aktivních filtrů (`.zapnuto`) a rychlé zrušení (`×`):**
  - Třídu `.zapnuto` (růžový rámeček a podbarvení) nyní dostávají všechny aktivní filtry v liště pod vyhledáváním, které nejsou ve výchozím stavu „vše“ — kromě `minHodnoceni` nově také `zobrazitCisla` (při volbě `s coverem`, `bez coveru` nebo `chybějící`) a vlastní `vyberId` v přehledu Nejlepší.
  - V nabídce `Výběr` v přehledu Nejlepší přibyla položka `Vše podle srdíček` pro přímý návrat z vlastního výběru.
  - Každý aktivní filtr v liště má přímo uvnitř tlačítka křížek `×` (`.volba-zrusit`), kterým (stejně jako `Shift+klikem` nebo prostředním tlačítkem myši) lze filtr okamžitě zrušit bez nutnosti otevírat rozbalovací nabídku.

## [0.33.2] – 2026-10-17

### Vylepšeno
- **Zobrazení počtu nalezených položek přímo v liště pod vyhledáváním (`#volbyPrehledu`):**
  - Na konci kapsle voleb pod vyhledáváním se nyní zobrazuje okamžité počítadlo položek (`.volby-pocet`, např. `48 modelek`, `38 čísel`, `24 centerfoldů`, `19 fotek`).
  - Doplněno předávání počtu zobrazených záznamů i pro stěnu centerfoldů (`nacistStenu`) a kalendář vydání (`nacistKalendar`), takže zpětná vazba při psaní do vyhledávání a přepínání filtrů funguje jednotně napříč všemi přehledy.

## [0.33.1] – 2026-10-17

### Vylepšeno
- **Tolerance mezery za dvojtečkou ve vyhledávání:**
  - Parser vyhledávání na backendu i frontendu (`rozlozitDotaz`) nyní toleruje mezeru za dvojtečkou u cílených filtrů — jak u prostých hodnot (`vlasy: blond`, `-vlasy: cerna`), tak u hodnot v uvozovkách (`fotograf: "arny freytag"`), relačních operátorů (`vyska: > 175`, `rok: >= 1990`) i vícenásobných hodnot oddělených čárkou (`vlasy: blond, zrzava`).
  - Samostatně rozepsaný klíč s dvojtečkou na konci dotazu (`vlasy:` nebo `vlasy: `) se při psaní ignoruje a nemaže výsledky galerie.
  - Našeptávač hodnot filtrů plynule nabízí možnosti i v případě, že uživatel za dvojtečkou napíše mezeru (`vlasy: `), a po výběru celý filtr sjednotí do tvaru `vlasy:blond `.

## [0.33.0] – 2026-10-17

### Přidáno
- **Našeptávání příkazů a tagů v hledání (Autocomplete syntaxe):**
  - Při napsání počátečních písmen (např. `v`, `t`, `r`) našeptávač automaticky nabídne relevantní příkazy (`vlasy:`, `vydani:`, `vyska:`, `vaha:`, `tag:`, `rok:`...).
  - Při psaní konkrétního filtru s dvojtečkou (např. `vlasy:`, `tag:`, `edice:`, `role:`, `narodnost:`, `oci:`, `tetovani:`) našeptávač dynamicky nabídne existující hodnoty z databáze s počty modelek (např. `vlasy:blond`, `vlasy:hnědá`, `tag:playmate`).
  - Vybrání položky kliknutím nebo klávesou Enter okamžitě doplní příkaz či hodnotu s mezerou do vyhledávacího pole.
- **Fuzzy matching (tolerance drobných překlepů):**
  - Implementace Levenshteinovy vzdálenosti (1–2 překlepy podle délky slova) pro jména modelek a fotografů.
  - Hledání toleruje překlepy jako `Pamella` místo Pamela nebo `Freitag` / `Fraetag` místo Freytag, a to jak v cílených filtrech (`jmeno:`, `fotograf:`), tak v obecném textovém hledání a našeptávači.
- **SQLite FTS5 fulltext pro články a texty alb:**
  - Vytvořena virtuální tabulka `texty_fts` (úprava schématu č. 10) využívající SQLite FTS5 s automatickým odstraněním diakritiky (`unicode61 remove_diacritics 2`) a relevančním skórováním BM25.
  - Automatická synchronizace článků i popisů alb přes databázové triggery při vložení, úpravě i smazání záznamů.
  - Nová backendová metoda `HledatTexty` pro bleskové full-textové prohledávání článků i alb s BM25 relevancí.

## [0.32.10] – 2026-10-17

### Přidáno
- Rozšíření syntaxe vyhledávání modelek, centerfoldů a vydání:
  - **Negace (vylučovací operátor `-` a `!`):** možnost vyloučit záznamy pomocí `-tag:playmate`, `-vlasy:cerna` nebo obecného textového vyloučení např. `-usa`.
  - **Numerická porovnání a rozsahy:** podpora relačních operátorů (`>`, `>=`, `<`, `<=`, `=`) a rozsahů (`..`, `-`) pro rok, výšku, váhu, datum narození a hodnocení/srdíčka (např. `rok:1970..1979`, `rok:1970-1979`, `rok:>=1980`, `vyska:>175`, `vyska:>=175`, `hodnoceni:>=4`, `srdicka:5`).
  - **Vícenásobné hodnoty (logické OR přes čárku):** možnost zadat více alternativ oddělených čárkou (např. `vlasy:blond,zrzava` pro nalezení blond NEBO zrzavých modelek, `edice:CZ,US`).
  - **Tolerance neuzavřených uvozovek:** rozepsaný dotaz s neuzavřenou uvozovkou (např. `fotograf:"arny`) automaticky doplní uzavření a nehledá doslovnou uvozovku v textu ani nemaže dosavadní výsledky při psaní.

## [0.32.9] – 2026-10-17

### Přidáno
- Rozšíření cíleného i obecného vyhledávání modelek v backendu:
  - nová pole pro cílené hledání: `vyska:`, `vaha:`, `miry:`, `hodnoceni:` / `srdicka:`, `tetovani:ano|ne`, `piercing:ano|ne`, `obalka:`, `umrti:`.
  - výška, váha, tetování, piercing, obálky a datum úmrtí se nyní prohledávají i v obecném textovém vyhledávání bez prefixu.
  - centerfoldy na stěně plakátů načítají fotografa a popis alba pro vyhledávání.

### Změněno
- Sjednocení logiky vyhledávání napříč všemi pohledy:
  - na stěně centerfoldů i stěně coverů a čísel se dotaz rozděluje na jednotlivá slova (logika AND) a prohledává modelky, vydání, fotografy i popisy.
  - v kalendáři vydání lze nyní vyhledávat nejen podle roku, ale i podle jména modelky, měsíce či speciálu daného roku.
  - v nejlepších fotkách funguje víceslovné vyhledávání i podle fotografa a vydání.
- Vylepšení rychlého našeptávače:
  - modelky se prohledávají nejen podle jména a pseudonymů, ale i podle role, národnosti, barvy vlasů, tagů a poznámky (se zachováním přednosti shody ve jméně).
  - pokud rychlý našeptávač nenajde žádné položky pro přímý skok, nezobrazuje velký blokující overlay překrývající stránku, ale tiše se zavře, aby uživatel viděl výsledky v galerii.
  - stisk Enter v poli hledání bez vybrané položky našeptávače pole opustí a zavře našeptávač pro okamžité procházení vyfiltrovaných karet.

## [0.32.8] – 2026-10-17

### Změněno
- Formulář alba (Přidat fotky / Upravit album) má růžový obvodový pruh se září, který jej vizuálně označuje jako měnící formulář (shodně s formulářem modelky).
- Svislé zarovnání polí ve formuláři: pole „Měsíc nebo speciál“ a „Rok vydání“ jsou v jedné rovině díky jednotnému spodnímu zarovnání popisků i při zalomení textu na dva řádky.
- Profil modelky: na titulní fotce se zobrazují štítky pro všechna čísla (rok i měsíc), ve kterých se modelka objevila (včetně edic a označení Playmate), s možností přímého prokliku do daného vydání.

## [0.32.7] – 2026-10-17

### Přidáno
- Do roadmapy přidána Etapa 15 (Pořádný editor a práce s textem):
  - plnohodnotný editor s nástrojovou lištou (tučné, kurzíva, nadpisy, odrážky, číslování, citace, kód)
  - živý náhled formátování (split-view nebo přepínač Úprava / Náhled)
  - klávesové zkratky (Ctrl+B, Ctrl+I, Ctrl+K, Tab pro odrážky)
  - šablony pro rozhovory a články (tlačítka mluvčích `PLAYBOY:` / `Jméno:`, perex)
  - zvětšení editoru na celé okno pro psaní a čtení dlouhých článků a povídek
  - sjednocení komponenty editoru pro články, alba i poznámky

## [0.32.6] – 2026-10-17

### Přidáno
- Podpora formátování textu pomocí Markdownu v popisech alb, textech článků a poznámkách modelky i čísla:
  - tučné písmo (`**text**`, `__text__`) a kurzíva (`*text*`, `_text_`), včetně kombinace (`***text***`)
  - odrážkové seznamy (`* položka`, `- položka`) a číslované seznamy (`1. položka`)
  - blokové citace (`> text`)
  - inline kód (`` `kód` ``) a přeškrtnutí (`~~text~~`)
  - nadpisy (`#`, `##`, `###`)
  - zachování perexu a zvýraznění mluvčího (`PLAYBOY:`) u článků

## [0.32.5] – 2026-10-17

### Změněno
- Stěna centerfoldů: karty mají jednotný rozměr v poměru 3:4 (jako galerie modelek).
  Plakát je celý vycentrovaný uvnitř rámu bez ořezu – formát na výšku vyplní výšku rámu,
  široký centerfold na šířku je vycentrovaný na tmavém podkladu pasparty.

## [0.32.4] – 2026-10-17

### Změněno
- Profil modelky: titulní fotka (a její výřez) zůstává vždy nahoře a centerfold ji už nenahrazuje.
  Centerfoldy se řadí dolů do levého panelu pod údaje modelky (s odkazem na vydání a textem alba),
  stejně jako je tomu na stránce čísla časopisu.

## [0.32.3] – 2026-10-15

### Změněno
- Stránka fotografa: alba a centerfoldy jako mřížka karet (jako ročník) – obálka alba s páskou vydání,
  u alb počet fotek, pod kartou jméno modelky a název alba; chronologicky. Nahoře filtr Vše · Centerfoldy ·
  Pictorialy a alba (jen když má fotograf obojí). Klik na kartu otevře album v prohlížeči fotek, pravé
  tlačítko nabídne profil modelky, výběr a další akce. Velké plakáty a řada štítků nad každým albem zmizely.

## [0.32.2] – 2026-10-15

### Změněno
- Stránka ročníku (klik na rok v Kalendáři) je přehled celého roku: 12 čísel jako karty – cover s páskou
  měsíce, v rohu náhled centerfoldu, pod kartou jméno playmate a co číslo obsahuje (cover · centerfold ·
  pictorialy), u výtisku štítek. Klik na kartu otevře číslo; chybějící měsíc má přerušovaný rámeček s plus
  a nabídne přidání a označení (sháním, mám výtisk). Pod tím speciály roku a alba celého ročníku. Vlevo
  panel s velkým tenkým rokem, proužkem „11 z 12“ a počty coverů, centerfoldů a pictorialů.
- Stránka fotografa má stejný levý panel: jméno velkými tenkými písmeny a počty alb, modelek a fotek.

## [0.32.1] – 2026-10-15

### Změněno
- Nabídky (pravé tlačítko, ⋯ vpravo nahoře, ⋯ u alba) v novém stylu: zaoblený průhledný panel, položky jako
  pilulky s růžovým zvýrazněním při najetí a skupiny s tenkým růžovým nadpisem (Fotka, Album, Modelky alba,
  Modelka; v ⋯ jméno modelky, Prohlížení, Údržba, Zálohy a data, Nastavení, Nápověda). Mazání zůstává červeně
  na konci. Dlouhá nabídka se v nízkém okně roluje.
- Lišta pro vybrané fotky (Ctrl+klik) je průhledná pilulka jako v prohlížeči fotek.

## [0.32.0] – 2026-10-15

### Přidáno
- Statistiky v Přehledu (nová položka v levém menu). Nahoře řádek velkých čísel s větou: počet centerfoldů
  a nejsilnější desetiletí, medián věku v době centerfoldu, nejčastější fotograf, počet národností a podíl
  té nejčastější. Pod ním karty s grafy: centerfoldy podle desetiletí, věk v době centerfoldu, nejčastější
  fotografové a národnosti (po osmi) a čísla ve sbírce podle edic US a CZ a desetiletí. Najetí myší na sloupec
  nebo řádek ukáže hodnotu. Věk se počítá jen u modelek se známým aspoň rokem a měsícem narození; fotografové
  se sjednocují bez ohledu na velikost písmen a diakritiku. Statistiky se počítají při prvním otevření oddílu.

## [0.31.6] – 2026-10-15

### Změněno
- Prohlížeč fotek: šipky ‹ › jsou na krajích horní pilulky (úplně vlevo a úplně vpravo), pořadí „3 / 22“
  zůstává vpravo vedle zavření.

## [0.31.5] – 2026-10-15

### Změněno
- Prohlížeč fotek: všechno ovládání v jedné průhledné pilulce nahoře přes celou šířku. Vlevo růžová páska
  vydání (BŘE 72), jméno velkými písmeny a odkud fotka je, uprostřed nástroje (srdíčka, rozložení,
  otočení, lupa, zamíchání, slideshow, ⋯), vpravo šipky ‹ › s pořadím „3 / 22“ a zavření. Šipky po
  stranách fotky zmizely. Panely prohlížeče jsou průhledné, fotka pod nimi rozostřeně prosvítá; lišta alb
  dole je pilulka ve stejném stylu.

## [0.31.4] – 2026-10-15

### Změněno
- Centerfoldy v novém stylu jako výstava tisků: každý plakát v lehkém tmavém rámu (pasparta), přes rám
  růžová páska vydání (jako v Číslech), pod rámem jméno velkými písmeny a vydání růžově – vidět pořád, ne
  až po najetí. Při řazení podle vydání jsou desetiletí oddíly s velkým tenkým nadpisem a růžovou linkou
  (jako roky v Kalendáři) a čtou se po řádcích.

## [0.31.3] – 2026-10-15

### Změněno
- Nejlepší už nejsou rozdělené po modelkách: jedna mozaika nejlepších fotek celé sbírky, řady stejné výšky,
  fotky v přirozeném poměru stran (neořezané na výšku), od nejvíce srdíček. Srdíčka jsou v rohu fotky, jméno
  modelky (odkaz na profil) a odkud fotka je se ukáže po najetí myší. Lišta nahoře skáče na úrovně srdíček.
  Vlastní výběry, prahy srdíček, slideshow a výběr více fotek fungují jako dřív.

## [0.31.2] – 2026-10-15

### Změněno
- Kalendář v novém stylu jako časová osa obálek: rok velkým tenkým číslem s růžovou linkou, měsíc jako
  růžová páska na obálce (jako v Číslech), výtisk jako štítek. Barevné tečky nahradily tři linky na spodní
  hraně obálky (cover, centerfold, pictorial; růžová = číslo ho má). Chybějící číslo má přerušovaný rámeček
  s růžovým plus; speciály a sbalené prázdné roky jsou pilulky.

## [0.31.1] – 2026-10-15

### Změněno
- Rychlé výsledky hledání mají pozadí jako okno „Co je nového“ (zaoblené, s hlubokým stínem) a stránka pod
  nimi ztmavne. Klik vedle výsledky zavře, nic pod nimi se přitom neotevře.

## [0.31.0] – 2026-10-15

### Přidáno
- Rychlé výsledky pod hledáním: při psaní se pod polem ukážou modelky, články a čísla. Články se hledají
  i v textu (bez ohledu na diakritiku), u každého je úryvek s růžově zvýrazněnou shodou. Šipky vybírají,
  Enter otevře, Esc výsledky zavře. Článek se otevře v čísle rovnou na svém místě.
- Prohlížeč stran: skeny článku se otevřou na celé okno jako rozevřený časopis (dvojstrana se stínem
  u hřbetu, článek od liché strany začíná vpravo) nebo po jedné straně. Dole pás náhledů, listování
  šipkami nebo klikem na stranu, klávesy 1 a 2 přepínají rozložení (zapamatuje se).
- Články modelky: v profilu je poslední blok vlevo „Články“ (rozhovor, 20 otázek…) s rubrikou, číslem
  a stranou; klik otevře číslo na tomto článku.

## [0.30.3] – 2026-10-15

### Změněno
- Stránka čísla: články jdou pod sebou jedna za druhým podle stran (jako alba v galerii modelky), za nimi
  pictorialy. Tlačítka „předchozí / další“ a samostatný režim „Alba čísla“ jsou pryč, prostě se roluje.
- Obsah vlevo zvýrazňuje článek, který právě čteš, a ukazatel přečteného ho sleduje při rolování; levý panel
  se sám posune, aby zvýrazněná položka byla vidět. Klik na položku obsahu na článek doroluje.
- Každý článek má u rubriky vlastní „✎ upravit“.

### Opraveno
- Druhý odstavec článku už neobtéká velké úvodní písmeno perexu.

## [0.30.2] – 2026-10-15

### Změněno
- Stránka čísla: levá a pravá část se rolují nezávisle. Levý panel stojí na celou výšku okna a roluje si svůj
  obsah sám; kolečko u jeho konce už nepřejde na článek vpravo.
- Ukazatel přečteného: u čteného článku v obsahu se pod názvem plní tenká růžová čára podle toho, kolik
  článku už je odrolováno.
- V úzkém okně (pod 760 px), kde je levý panel nad obsahem, je nad článkem tenký proužek s obsahem čísla
  (čtený článek zvýrazněný) a ukazatelem přečteného; zůstává nahoře celou dobu čtení.

## [0.30.1] – 2026-10-15

### Změněno
- Centerfold čísla je v levém panelu pod údaji čísla (s modelkou a textem alba), vpravo zůstávají pictorialy.
  Klik na centerfold v obsahu na něj v panelu sjede, klik na plakát ho otevře v prohlížeči.

## [0.30.0] – 2026-10-15

Číslo časopisu jako magazín: obsah a články s textem. Schéma databáze: úprava č. 9 (tabulka článků). Formát
exportu: verze 7 (starší verze 1–6 se dál načtou).

### Přidáno
- **Obsah čísla** v levém panelu stránky čísla: články podle stran (číslo strany, rubrika drobnými růžovými
  kapitálkami, název), za nimi centerfold a pictorialy čísla. Levý panel při rolování zůstává na místě
  a obsah se v něm posouvá. Pod obsahem zkrácené údaje čísla (cover, centerfold, pictorialy, fotky, kdo je na
  obálce, stav).
- **Čtení článku** v pravé části: rubrika, strana a druh textu, velký nadpis, autor a modelka (odkaz na
  profil), první odstavec jako perex s růžovým iniciálem, citáty („> “) s růžovou čarou, zvýrazněné otázky
  („PLAYBOY:“), náhledy skenů stran (otevřou se v prohlížeči fotek) a odkazy na předchozí a další článek.
  „Alba čísla“ vrátí centerfold a pictorialy; při čtení je cover v panelu menší.
- Okno **Nový článek / Upravit článek** (styl okna Doplnit modelku): rubrika s nabídkou obvyklých (Úvodník,
  Playboy Interview, 20 otázek, Článek, Povídka, Móda, Humor, Advisor, Pictorial, Centerfold) i vlastních,
  autor, strana, název, modelka ze sbírky, druh textu (přepis, shrnutí), text a odkazy na skeny z Disku;
  mazání článku s potvrzením.
- Články v exportu a importu u vydání (klíč `clanky`); článek se v čísle pozná podle názvu, prázdný údaj
  ponechá stávající, „-“ ho smaže. Popis v EXPORT.md a vzor-exportu.yaml.

### Změněno
- Přidávání do čísla jako pilulka **+ Cover | + Centerfold | + Pictorial** pod názvem čísla.

## [0.19.2] – 2026-10-15

### Změněno
- Přehled, **Souhrn**: místo karet jeden panel s pokrokem sbírky po položkách (Modelky s titulní fotkou,
  s centerfoldem, s hodnocením, Alba s textem a s vydáním, Vydání s coverem a s centerfoldem): pruh, „19 z 22“
  a pilulka „doplnit 3“ (hotové „hotovo“). Klik na řádek otevře část, kde se doplňuje.
- Přehled, **Ke kontrole**: místo tabulky seznam s kulatou fotkou, jménem, popisem problému a tlačítkem
  **Opravit** (album s jednou fotkou otevře profil, ostatní formulář modelky); klik na řádek otevře profil.

## [0.19.1] – 2026-10-15

### Změněno
- Okno **Doplnit modelku**: bez fotky v hlavičce. Titulní fotka se místo odkazu vybírá kliknutím z fotek modelky
  v galerii (vybraná má růžový rámeček); modelka bez fotek nabídne „Přidat fotky / album…“.
- **Upravit modelku** má stejné rozložení a vzhled jako okno Doplnit modelku: růžový rámeček, části (Základní
  údaje, Vzhled a míry, Zařazení a poznámky) pod sebou s růžovými nadpisy místo záložek, bez křížku – zavírá se
  tlačítkem Zrušit. Odkaz z Přehledu posune formulář rovnou na příslušnou část.

## [0.19.0] – 2026-10-15

Nový vzhled celého programu (řada 0.18.x) završený oknem pro doplňování modelek. Schéma databáze ani formát
exportu se nemění.

### Přidáno
- Okno **Doplnit modelku**: v Přehledu (část Modelky) klik na kartu modelky otevře plovoucí okno s růžovým
  rámečkem. V hlavičce fotka, jméno a pruh vyplněnosti; pod ní jen to, co modelce chybí: odkaz na titulní fotku,
  chybějící pole základních údajů, vzhledu a zařazení (stejná pole a nabídky jako ve formuláři modelky),
  hodnocení srdíčky, vydání alb bez vydání, tlačítka pro přidání centerfoldu a pro text alb. U každého bloku
  „netýká se“. Dole **Zrušit**, **Otevřít profil**, **Uložit a další →** (uloží a otevře další modelku v pořadí
  Přehledu) a **Uložit**. Klik na konkrétní údaj na kartě otevírá formulář jako dřív.

### Změněno
- Dialogová okna v jednotném stylu: plovoucí panel se zaoblenými rohy, nadpis tenkými kapitálkami, tlačítka jako
  pilulky (hlavní akce plná růžová, ostatní s tenkým okrajem), pole se zaoblenými rohy.
- **Co je nového** a nápověda: nadpisy verzí a kapitol tenkými kapitálkami s růžovou linkou, podnadpisy
  (Přidáno, Změněno) drobnými růžovými kapitálkami, „Zavřít“ jako pilulka.
- Fotka na kartičce modelky v Přehledu má zaoblené rohy i vpravo.

## [0.18.14] – 2026-10-15

### Změněno
- Přehled, část **Modelky**: místo tabulky kartičky ve dvou sloupcích. Fotka vyplní celou levou stranu karty
  (jako karty v galerii), jméno je tenkými kapitálkami, pod ním pruh vyplněnosti s procenty a výčet toho, co
  chybí („Základní údaje 3 z 4“, „Centerfold ✕“). Klik na údaj ho nabídne doplnit, pravým tlačítkem jde označit
  „netýká se“, klik jinam na kartu otevře profil.
- Svítící tečky u chybějících údajů jsou pryč, v tabulce Vydání je „chybí“ zase jen růžovým textem.

## [0.18.13] – 2026-10-15

### Změněno
- Přehled má nové rozložení jako profil modelky: vlevo plovoucí panel **Sbírka** s čísly (modelky, alba, fotky,
  se srdíčky, covery, vydání), menu částí **Souhrn, Modelky, Vydání, Ročníky, Ke kontrole** s počty (kde něco
  chybí, růžově) a pruhy „Modelky s úplnými údaji“ a „Vydání s coverem i centerfoldem“. Vpravo je vždy jen
  zvolená část; poslední zvolená se pamatuje.
- Nová část **Souhrn** s kartami toho, co zbývá doplnit (bez titulní fotky, bez centerfoldu, bez hodnocení,
  alba bez textu a vydání, vydání bez coveru a centerfoldu, ke kontrole); klik na kartu otevře příslušnou část.
  Připravené místo pro grafy.
- Nadpisy částí tenkými kapitálkami s růžovou linkou, tabulky v plovoucích panelech, u chybějícího údaje
  zářící růžová tečka; jména modelek v tabulce na jeden řádek.

## [0.18.12] – 2026-10-15

### Změněno
- Lišta alb (v profilu) a jmen (v Nejlepších) je plovoucí pilulka; zvolená položka má tenký růžový rámeček
  s podbarvením. Horní hrana lišty lícuje s levým panelem a při rolování pod ní neprosvítá obsah.
- Nadpisy alb jsou tenkými kapitálkami s růžovou linkou, která se ztrácí (jako nadpisy v levém panelu).
- Fotky v albech mají zaoblené rohy a jemný stín, mezi alby je víc místa.

## [0.18.11] – 2026-10-15

### Změněno
- Levý panel profilu modelky, stránky čísla a fotografa je jeden plovoucí panel se stínem. Fotka (titulní,
  centerfold nebo cover) vyplní horní část až k okrajům a dole končí zaoblenými rohy. V levém horním rohu je
  růžová páska s prvním číslem („PLAYMATE · BŘE 95“, u čísla „LED 96“). Jméno je tenkými kapitálkami na střed,
  srdíčka pod ním. Tlačítka (Upravit, Přidat fotky, Upravit číslo) jsou v jedné pilulce s dělicí čarou.
  Údaje už nejsou v rámečku, nadpisy bloků jsou růžové s linkou, která se ztrácí.

## [0.18.10] – 2026-10-15

### Změněno
- Zvolená záložka (Modelky, Čísla, Centerfoldy) má místo krátké čárky růžovou linku přes celé slovo, která se
  na koncích ztrácí a jemně září. Na profilu a stránce čísla je linka tlumená, bez záře.

## [0.18.9] – 2026-10-15

### Změněno
- Otevření nabídky volby už panel ani volbu nezvýrazňuje (jako před 0.18.8). Růžový rámeček s podbarvením
  zůstává jen u zapnutého filtru.

## [0.18.8] – 2026-10-15

### Změněno
- Panel voleb pod hledáním reaguje jako hledání: dokud je otevřená nabídka některé volby, má celý panel tenký
  růžový rámeček. Zapnutý filtr i právě vybíraná volba mají tenký růžový rámeček a růžové podbarvení.

## [0.18.7] – 2026-10-15

### Změněno
- Pole hledání má vzhled panelu voleb pod ním: zaoblená pilulka s okrajem a stínem, růžová lupa.

### Přidáno
- **Ctrl+F** skočí do hledání a označí jeho text (mimo otevřené okno, prohlížeč fotek a zamčený program).
  Vpravo v poli je nápověda „Ctrl F“; při psaní ji nahradí tlačítko **✕**, které hledání smaže.

## [0.18.6] – 2026-10-15

### Změněno
- Nové rozložení hlavní lišty: vlevo záložky **Modelky, Čísla, Centerfoldy**; uprostřed přesně pod hledáním
  panel voleb přehledu (řazení, filtry); vpravo ikonová tlačítka **Kalendář, Nejlepší, Přehled** (zvolené
  podbarvené akcentem, název v nápovědě), za čárou **+** a **⋯**.
- Počet položek („22 modelek“, „78 fotek“) už v liště není, ukáže ho nápověda zvolené záložky nebo ikony.

## [0.18.5] – 2026-10-15

### Změněno
- Záložka **Covery** je nahrazená záložkou **Čísla**: galerie všech čísel časopisu, ke kterým je ve sbírce
  cover, centerfold nebo pictorial, po ročnících s počtem „11 z 12“. Každé číslo vypadá jako výtisk se stínem
  a růžovou páskou měsíce („BŘE 95“, u speciálu „SPECIÁL 95“), pod ním jméno playmate. Číslo bez coveru ukazuje
  ztlumený náhled se štítkem „bez coveru“; štítky „výtisk“ a „sháním“ podle označení čísla. Chybějící číslo
  označené „sháním“ nebo „mám výtisk“ je přerušovaná dlaždice „Ve sbírce chybí“.
- V horní liště volby **Edice** (sdílená s kalendářem) a **Zobrazit** (vše, s coverem, bez coveru, chybějící).
  Klik na číslo otevře jeho stránku; pravé tlačítko nabízí cover (zobrazit, upravit, smazat, nebo přidat)
  a označení čísla (mám výtisk, sháním, nezajímá mě).

Beze změny schématu databáze a formátu exportu.

## [0.18.4] – 2026-10-15

### Změněno
- Volby přehledu v horní liště (Řazení, Srdíčka, Výběr, Edice, Spustit slideshow) jsou v jednom zaobleném
  plovoucím panelu s dělicími čarami. Hodnota je tučně, šipka ▾ v barvě akcentu; zapnutý filtr srdíček je
  podbarvený a jeho hodnota v akcentu; „Spustit slideshow“ je v akcentu jako akce. Počet zůstává vedle panelu.
- Tlačítka **✎ Upravit** a **+ Přidat fotky** pod jménem modelky mají vzhled samostatných voleb (tmavá karta
  s tenkým okrajem) místo plovoucího panelu z 0.18.3.

## [0.18.3] – 2026-10-15

### Změněno
- Tlačítka pod jménem modelky mají nový vzhled plovoucího panelu (jako lišta prohlížeče fotek): jeden zaoblený
  panel, tlačítka **✎ Upravit** a **+ Přidat fotky** oddělená tenkou čarou, ikony v barvě akcentu. Styl je
  připravený jako společný (`.plovouci-skupina`, `.plovouci-tlacitko`) a postupně do něj přejdou další prvky.

## [0.18.2] – 2026-10-14

### Změněno
- Tlačítka **Upravit modelku** a **+ Přidat fotky / album** jsou v profilu pod jménem modelky v levém panelu,
  u údajů, které upravují. Nadpis „Alba a fotogalerie“ nad alby je pryč, lišta alb začíná hned nahoře.

### Opraveno
- V úzkém okně (pod 760 px) profil modelky přetékal vpravo za okraj okna kvůli široké liště alb.

## [0.18.1] – 2026-10-14

### Změněno
- Údaje v levém panelu profilu modelky jsou v jedné kartě rozdělené do bloků **Playboy** (vydání, role a obálky
  jako štítky), **Osobní** (narození s věkem v prvním vydání, úmrtí, národnost) a **Vzhled** (mřížka ve dvou
  sloupcích). Tetování a piercing se ukážou jen jako štítek, když je odpověď „ano“; prázdné bloky se skryjí.

## [0.18.0] – 2026-10-14

Poslední úprava schématu před alfou podle rozhodnutí z auditu. Schéma databáze: úprava č. 8. Formát exportu:
verze 6 (starší verze 1–5 se dál načtou).

### Přidáno
- Datum úmrtí u modelky: ve formuláři vedle data narození, v profilu i s věkem, v exportu jako `umrti_datum`.
- U čísla časopisu jde do „Na obálce“ napsat i jméno, které ve sbírce není; uloží se jako text (v exportu
  `na_obalce`). Jméno modelky ze sbírky se dál propojí s jejím profilem.
- Import: hodnota `-` údaj smaže (text, čísla, ano/ne, titulní fotku, text a fotografa alba, údaje čísla).
- Import: překlep v klíči (`narodnot:`) se opraví na nejbližší známý klíč, neznámý klíč se přeskočí; obojí
  se po importu vypíše s číslem řádku.

### Změněno
- Data narození a úmrtí smí být neúplná: `RRRR`, `RRRR-MM` nebo `RRRR-MM-DD`. Formulář má místo kalendáře
  textové pole a jiný tvar (nebo úmrtí před narozením) nepustí; v profilu se neúplné datum ukáže jako
  „srpen 1950“ nebo „1950“. Import datum v jiném tvaru ohlásí a stávající ponechá.
- Soubor s jedinou modelkou a chybným údajem (např. text místo čísla) import odmítne s hláškou, co je špatně.

## [0.17.16] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Pole hledání je v horním řádku okna přesně uprostřed šířky okna; v užším okně se zúží, v nejužším zmizí.
  Hlavní lišta pod ním má celé místo pro záložky, volby a akce.

## [0.17.15] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- V horním řádku okna už není tlačítko „← Modelky“; zpět vede Esc nebo Alt+šipka vlevo, do jiného přehledu
  záložky. Šipky na předchozí a další modelku v profilu zůstávají.

## [0.17.14] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- V horním řádku okna už není ani ikona programu; zůstávají jen tlačítka okna (a v profilu cesta zpět).

### Opraveno
- Zamčený program (s heslem) od verze 0.17.0 ukazoval v hlavičce záložky přehledů, volby, + a ⋯. Před
  odemčením jsou zase vidět jen tlačítka okna.

## [0.17.13] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- V horním řádku okna už není název programu, zůstala jen ikona (a v profilu cesta zpět).

## [0.17.12] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Prohlížeč fotek: ovládání (panel nástrojů, lišta alb, šipky, popisek, zavření) je vidět po otevření
  a po pohybu myší a asi po 2,5 s nečinnosti zmizí; nad ovládáním zůstává, dokud tam je myš. Listování
  klávesami ho neukazuje.
- Fotka v prohlížeči sahá od horního po spodní okraj okna (nebo od kraje ke kraji); ovládání leží přes ni.

## [0.17.11] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Opraveno
- Galerie modelek se nemusela vykreslit: pruh se jménem na každé kartě rozmazával pozadí a se stovkami
  karet najednou to WebKitGTK nezvládl. Pruh má teď obyčejné poloprůhledné pozadí.

## [0.17.10] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Na kartě modelky je jméno vidět pořád (průhledný pruh přes spodek fotky). Srdíčka jsou vidět pořád
  u hodnocené modelky, u nehodnocené jen po najetí myší. Centerfoldy a covery mají popisek dál jen po najetí.

## [0.17.9] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Opraveno
- Při přibližování výřezu titulní fotky kolečkem myši mohl panel výřezu zmizet pod přiblíženou fotkou.
  Panel teď leží nad fotkou v samostatné vrstvě; kolečko přibližuje i nad panelem a stránka se přitom
  neposouvá.

## [0.17.8] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Srdíčka na kartě modelky se ukážou jen po najetí myší (nebo při výběru klávesnicí), i u hodnocené modelky;
  bez myši je na kartě jen fotka.

## [0.17.7] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Jméno na kartě modelky, centerfoldu a coveru je zase pruh přes celou šířku dole, teď ale průhledný přes
  fotku a jen po najetí myší.
- Ovládání výřezu titulní fotky má dva řádky: nahoře posuvník přiblížení přes celou šířku, pod ním tlačítka.

## [0.17.6] – 2026-10-14

Fotky přes celé karty. Schéma databáze ani formát exportu se nemění.

### Změněno
- Karty modelek, centerfoldů a coverů ukazují jen fotku přes celou kartu. Jméno (u centerfoldu a coveru
  i vydání) je v plovoucím panelu vlevo dole a objeví se po najetí myší nebo při výběru klávesnicí.
- Srdíčka na kartě modelky jsou v levém horním rohu.

## [0.17.5] – 2026-10-14

Plovoucí panely na fotkách a v dialozích. Schéma databáze ani formát exportu se nemění.

### Změněno
- Úprava výřezu titulní fotky má ovládání v plovoucím panelu přímo na fotce karty (posuvník přiblížení,
  výchozí výřez, zrušit, uložit); jméno modelky pod fotkou zůstává vidět.
- Srdíčka a tlačítko ⋯ na dlaždici fotky a na kartě modelky jsou malé plovoucí panely v rozích fotky,
  čitelné i na světlé fotce.
- Dialogová okna mají stejný povrch, okraj a stín jako plovoucí panely; pozadí za nimi je méně tmavé
  a křížek se po najetí myší podbarví. Rozložení oken se nemění.

## [0.17.4] – 2026-10-14

Plovoucí panely i mimo prohlížeč. Schéma databáze ani formát exportu se nemění.

### Změněno
- Lišta pro vybrané fotky je plovoucí panel s ikonami (přesunout do alba, přidat do výběru, vybrat vše,
  odebrat, zrušit výběr); srdíčka jsou obrys a po najetí myší se vyplní až po to pod kurzorem.
- Nabídky (⋯, pravé tlačítko, volby v liště) a oznámení mají stejný povrch jako panely v prohlížeči;
  položka nabídky se po najetí jen jemně podbarví, mazání zůstává červené.

## [0.17.3] – 2026-10-14

Prohlížeč fotek s plovoucími panely. Schéma databáze ani formát exportu se nemění.

### Změněno
- Nástroje prohlížeče jsou v plovoucím panelu nahoře uprostřed (srdíčka, rozložení, otočení, lupa,
  zamíchání, slideshow, ⋯) s ikonami a oddělenými skupinami; popisek a počítadlo jsou nenápadně vlevo
  nahoře, Zavřít vpravo.
- Lišta alb dole je plovoucí panel uprostřed, jen tak široký, jak je potřeba.
- Šipky na předchozí a další fotku jsou nenápadné, po najetí myší mají kulaté podbarvení. Průběh slideshow
  je tenká čára nahoře.

## [0.17.2] – 2026-10-14

Čistší vzhled štítků. Schéma databáze ani formát exportu se nemění.

### Změněno
- Štítky v celém programu (alba v profilu, jména v Nejlepších, stránka vydání, lišta alb v prohlížeči, vydání
  v údajích modelky) mají vzhled rejstříku: bez rámečků, tlumený text, jemné podbarvení po najetí myší;
  zvolený má růžové podbarvení a tučný text. Lišty alb nemají dělicí čáru, šipky jsou bez kroužků.
  Rozložení se nemění.

## [0.17.1] – 2026-10-14

Volby přehledu v horní liště. Schéma databáze ani formát exportu se nemění.

### Změněno
- Řazení, Srdíčka, Výběr a Edice jsou rozbalovací tlačítka přímo v horní liště za záložkami, i s počtem
  (22 modelek); nad obsahem už žádný samostatný řádek není. V Nejlepších je v liště i Spustit slideshow
  a přejmenování a smazání výběru je v nabídce Výběr. V užším okně ubude počet a popisky voleb.

## [0.17.0] – 2026-10-14

Nová navigace ve stylu Fotek ve Windows. Schéma databáze ani formát exportu se nemění.

### Změněno
- Hlavička okna má dva řádky: nahoře název programu, cesta zpět z profilu nebo vydání a tlačítka okna; pod ním
  hlavní lišta se záložkami přehledů (podtržená je zvolená), hledáním s lupou uprostřed a akcemi + a ⋯.
- Záložky přehledů zůstávají vidět i v profilu modelky a na stránce vydání, jinam se jde jedním klikem.
- Volby přehledu jsou rozbalovací tlačítka nad obsahem: Řazení ▾, Srdíčka ▾, Výběr ▾, Edice ▾ místo řad štítků.
- Rejstřík (písmena, roky, měsíce) se ukáže u pravého okraje jen při rolování nebo po najetí myší k okraji;
  jinak obsah zabírá celou šířku okna.

## [0.16.1] – 2026-10-14

Méně nevyužitého místa v přehledech. Schéma databáze ani formát exportu se nemění.

### Změněno
- Svislá lišta vlevo je úzký rejstřík: jen písmeno, rok nebo měsíc (A, 1970, Bře 26) bez rámečků; celý název
  a počet jsou v nápovědě po najetí myší. Zabírá zhruba třetinu dřívější šířky.
- Nejlepší mají lištu jmen modelek zase vodorovně nahoře; celá jména se do úzkého pruhu nevejdou.
- Karty v galerii modelek vyplní celou šířku okna, vpravo nezůstává prázdný pruh.

## [0.16.0] – 2026-10-14

První fáze sjednocení rozhraní podle průchodu celým programem. Schéma databáze ani formát exportu se nemění.

### Změněno
- Horní lišta se vejde do každé šířky okna: postupně ubývá název programu, šířka přepínačů a jejich text
  (zkratky Mod, Cf…), v nejužším okně hledání. Tlačítka okna (Zavřít) zůstávají vždy vidět.
- Zvolený štítek a režim mají růžové podbarvení; najetí myší jen zvýrazní okraj, takže se obojí nedá splést.
- Svislá lišta přehledů má pevnou šířku: obsah začíná ve všech přehledech na stejném místě a neposkočí,
  když lišta zmizí (filtr srdíček, řazení stěny).
- Mazání je červené a v nabídkách vždy poslední za oddělovačem (modelka, album, cover, fotka, celá databáze).
  V potvrzovacím okně mazání a dalších nevratných akcí (sloučení modelek, obnovení ze zálohy) je výchozí
  volbou Zrušit, takže je Enter neprovede omylem.
- Pole hledání říká, co v daném přehledu hledá (modelku, jméno nebo vydání, rok…); v Přehledu je vypnuté.
- Srdíčka u fotky v profilu se změní na místě; album se podle nich seřadí až při dalším otevření, fotka tak
  neodskočí pod rukama a stránka zůstane, kde byla.
- Tlačítka a pole mají písmo okna. Růžový text má lepší kontrast, tlačítka v barvě akcentu jsou tmavší.

### Přidáno
- Zavření rozepsaného okna modelky, alba nebo coveru (Esc, křížek, Zrušit) se zeptá, zda změny zahodit.

## [0.15.0] – 2026-10-14

Jednotné volby v přehledech a svislá lišta pro skákání. Schéma databáze ani formát exportu se nemění.

### Změněno
- Řazení a filtr srdíček u Modelek jsou štítky nad kartami (abecedně, nově přidané, podle roku; ♥ 1+ až ♥ 5)
  jako volby u Centerfoldů a Nejlepších, ne tlačítka v horní liště. Klik na zvolený filtr srdíček ho zruší;
  vedle je počet zobrazených modelek.
- Lišta pro skákání v přehledech (písmena nebo měsíce u Modelek, desetiletí u Centerfoldů, ročníky coverů,
  kalendář, modelky v Nejlepších) je svislý sloupec vlevo, který při rolování zůstává na místě. Když se do
  okna nevejde, roluje se sám a má šipky nahoru a dolů. Lišta alb v profilu zůstává nahoře.

## [0.14.3] – 2026-10-14

Opravy nálezů auditu před alfou. Schéma databáze ani formát exportu se nemění.

### Opraveno
- Data: import v režimu jen pro čtení (poškozená nebo novější databáze) už nezapisuje; sloučení modelek
  nesmaže album, kterému zůstal jen text; smazání modelky sloučí sdílené album se stejnojmenným albem další
  modelky místo smazání jeho fotek; obnovení nejstarší zálohy ji už nesmaže dřív, než se zkopíruje; po
  nezdařené úpravě obnovené zálohy přejde program do režimu jen pro čtení; export a import zachovají datum
  přidání coverů.
- Import ručně psaných souborů: řádek „Zdroj: …“ uvnitř neodsazené poznámky zůstane v poznámce; blok kódu
  jiného jazyka (json…) v Markdownu už nepřebere okolní text.
- Rozhraní: okna (Přidat do výběru…, formuláře) se z prohlížeče otevírají nad ním; profil po šipkách a Zpět
  ukazuje čerstvé údaje a formulář už nepřepíše dřívější úpravu; „Odebrat“ a Delete ve vlastním výběru
  odebírají jen z výběru; po uložení alba se obnoví i vydání a věk v hlavičce profilu; okno alba zůstane
  otevřené, když se neuloží žádná fotka; ⋯ na plakátu centerfoldu nabízí akce s fotkou; Esc zavře prohlížeč
  dřív než výběr pod ním; „Otevřít profil“ z prohlížeče prohlížeč zavře; klávesa nabídky v prohlížeči ukáže
  akce s fotkou; Alt+← a ? nefungují nad oknem, prohlížečem a zámkem; ročník nepočítá speciály mezi 12 čísel;
  rok s označeným číslem se v kalendáři nesbalí; zrušený „Nový speciál…“ vrátí původní měsíc; „Co je nového“
  rozliší předběžné verze (alpha, beta, rc).
- Výkon: profil modelky se načítá přes index alb (na sbírce 500 modelek a 20 000 fotek z 14–48 ms na 6 ms),
  export celé sbírky z 10,7 s na 2,2 s, import z 12,4 s na 4,6 s, převod staré databáze schématu 5 z 12 s
  na desetiny sekundy; hromadné zápisy (srdíčka, otočení, výběry) v jedné transakci.

## [0.14.2] – 2026-10-14

### Opraveno
- Import ručně psaných a převedených souborů (např. Markdown z Google Dokumentů): položka seznamu začínající
  odrážkou `*` nebo `+` místo pomlčky, víceřádkový text pod `|`, který ztratil odsazení, odsazení tabulátorem,
  dvojtečka uvnitř hodnoty a blok kódu v Markdownu bez označení `yaml` (i s `~~~`). Správně napsané soubory
  se čtou beze změny.

## [0.14.1] – 2026-10-14

Oprava chyby z verze 0.14.0. Schéma databáze ani formát exportu se nemění.

### Opraveno
- Potvrzovací okno nešlo potvrdit: import souborů, smazání modelky, přidání modelky se jménem, které už ve
  sbírce je, smazání databáze a další dotazy ano/ne se po kliknutí na tlačítko neprovedly a okno zůstalo otevřené.

## [0.14.0] – 2026-10-14

Dokončení etapy 10 roadmapy: nápověda, novinky a úvod v programu. Schéma databáze ani formát exportu se nemění.

### Přidáno
- Nápověda v programu: klávesa `?` nebo ⋯ → Nápověda. Klávesy prohlížeče, akce a výběr, cílené hledání,
  čísla časopisu a speciály, Přehled, import a zálohy.
- „Co je nového“: po aktualizaci se jednou ukáže, co přibylo od naposledy viděné verze; z nabídky ⋯ (položka
  Verze) posledních pět verzí. Text se bere z CHANGELOG.md při sestavení programu.
- Úvod prázdné sbírky: první kroky (sdílení na Disku, první modelka, import, heslo) s tlačítky.

### Změněno
- Číslování připravené na předběžné verze `1.0.0-alpha.N`, `1.0.0-beta.N` a `1.0.0-rc.N`.
- Smazání celé databáze se potvrzuje napsáním slova SMAZAT; okno řekne, kolik modelek se smaže a jak sbírku
  obnovit ze zálohy.

## [0.13.0] – 2026-10-14

První část etapy 10 roadmapy (příprava k vydání): rozhodnutí o řazení, výtiscích a speciálech a instalace.

### Přidáno
- Řazení galerie jedním tlačítkem vedle ♡: abecedně, naposledy přidané, podle roku prvního vydání; lišta nad
  galerií ukazuje podle řazení písmena, měsíce přidání nebo desetiletí. Volba se pamatuje.
- Stav čísla „mám výtisk“ vedle „sháním“ a „nezajímá mě“; v kalendáři zelený rámeček.
- Instalace do nabídky aplikací skriptem `instalovat.sh` (bez sudo, i aktualizace a odinstalace); v README
  postup přenosu dat na jiný počítač.
- Speciály (Playmate Review, Lingerie…): čísla mimo měsíční řadu s vlastním názvem, klíč `RRRR-Snn`
  (s edicí `RRRR-Snn-CZ`). Zakládají se v okně alba a coveru nebo z kalendáře, v kalendáři jsou štítky pod
  měsíci, ročník je zahrnuje, Přehled je mezi čísly bez centerfoldu nepočítá.

### Změněno
- Schéma databáze: úprava č. 7 (název speciálu u čísla). Formát exportu: verze 5 (`nazev` u vydání).

## [0.12.0] – 2026-10-14

Import více souborů a Markdownu (vydáno samostatně před zbytkem etapy 10). Schéma databáze se nemění, formát
exportu zůstává verze 4; import jen přijímá víc podob souboru.

### Přidáno
- Import více souborů najednou (jedna záloha, jedna transakce: buď vše, nebo nic). Kromě `.yaml` a `.yml`
  bere i `.md`: YAML z bloků ```yaml, z úvodní hlavičky mezi `---`, jinak celý soubor.
- Soubor může obsahovat jen jednu modelku s údaji přímo nahoře (bez `modelky:`), nebo seznam modelek.

### Opraveno
- Modelka uvedená v importu dvakrát (třeba ve dvou souborech) se doplní, nezaloží se podruhé a druhý výskyt
  nesmaže údaje z prvního.

## [0.11.0] – 2026-10-14

Etapa 9 roadmapy: rozhraní na dlouhou trať. Schéma databáze ani formát exportu se nemění.

### Přidáno
- Tlačítko ⋯ na dlaždici fotky, na plakátu a v prohlížeči: přidat do výběru, otevřít profil, otevřít na Disku,
  kopírovat odkaz, odebrat. Do výběru jde fotka přidat odkudkoli, nejen z profilu.
- Výběr více fotek i na stránce vydání, ročníku a fotografa a v Nejlepších; Ctrl+A vybere vše, Delete vybrané
  odebere (s možností vrátit), tlačítko Vybrat vše.
- Ovládání klávesnicí: karty a dlaždice jdou zaměřit Tabem a otevřít Enterem, kontextová nabídka se ovládá
  šipkami, okna a prohlížeč drží fokus uvnitř a po zavření ho vrátí; klávesa nabídky ukáže akce u prvku.

### Změněno
- Rozhraní je rozdělené z jednoho souboru o 3 700 řádcích do modulů po pohledech; sdílený stav je na jednom
  místě a po každém zápisu do databáze se mezipaměti pohledů zahodí samy, takže žádný pohled neukáže stav před
  změnou. Seznam modelek se načítá jednou a sdílí.
- Kontrola typů rozhraní (`npm run typy`) včetně volání backendu.
- Nejlepší a stránky vydání se skládají bez hledání v poli u každé dlaždice; oddíly Nejlepších mimo obrazovku
  se nevykreslují.
- Sjednocené texty („Upravit modelku“ místo „Editovat“, „Přidat do výběru…“) a nápovědy, které zmiňovaly
  jen pravé tlačítko.

### Opraveno
- Počet fotek u alba s nula fotkami se psal „0 fotky“.

## [0.10.0] – 2026-10-14

Etapa 8 roadmapy: pevné schéma. Schéma databáze: úprava č. 6. Formát exportu: verze 4 (popis v [EXPORT.md](EXPORT.md)).
Vzhled programu se nemění.

### Změněno
- Album je samostatný záznam: fotky na něj odkazují, vydání a spojení plakátu jsou údaje alba. Text, fotograf,
  „netýká se“ i další modelky přežijí odebrání poslední fotky a vrátí se s novými fotkami; celé album maže
  jen Smazat album.
- Cover časopisu je album bez modelky (dřív zástupná modelka 0); databáze hlídá vazby cizími klíči.
- Vydání je uložené u všech typů alb a má index.
- Každá úprava schématu běží v transakci spolu s číslem schématu: nezdařená úprava se vrátí celá.
  Úprava č. 1 je zmrazená a chyby už nezamlčuje.
- Export verze 4: novější soubor se odmítne celý, modelky stejného jména se rozliší číslem, přibylo
  „netýká se“, datum přidání každé fotky, spojení a pořadí coverů a alba bez fotek.

### Opraveno
- Import do sbírky se dvěma modelkami stejného jména je už nesloučí.
- Backend kontroluje typ alba, název centerfoldu a coveru, edici a klíče „netýká se“ jedním pravidlem
  pro zadávání i import; dřív přijal i to, co import pak odmítl.
- Typ prsou a ochlupení z importu se uloží v tvaru z nabídky formuláře bez ohledu na velikost písmen
  („přírodní“ → „Přírodní“); dřív je formulář nepoznal a další uložení údaj smazalo. Hodnota mimo nabídku
  se ohlásí.

## [0.9.1] – 2026-10-14

Etapa 7 roadmapy: opravy chyb nalezených při ověření verze 0.9.0. Schéma databáze ani formát exportu se nemění.

### Opraveno
- Výkon velké sbírky: galerie, kalendář a Přehled už nepoužívají dotazy rostoucí se součinem modelek a fotek
  (na 500 modelkách a 20 000 fotkách galerie z 15,7 s na 0,09 s, kalendář z 8,2 s na 0,15 s, Přehled z 38 s
  na 0,4 s); výkonnostní test hlídá, že to tak zůstane.
- Import běží na vlastním spojení a při jakékoli chybě zápisu se celý vrátí; souběžné změny se do něj nepřimíchají.
  Obnovení ze zálohy nejdřív vymění soubor a staré spojení zavře až potom; adresa obrázků zůstává současná.
- Vrátit po odebrání fotky už nepřepíše jiné oznámení a vrátí i členství ve výběrech, další modelky alba
  a „netýká se“.
- „Netýká se“ u alba přežije uložení prázdného textu; v tabulce Vydání znamená stav „nezajímá mě“.
- Sloučení alb ponechá duplicitní fotce vyšší hodnocení a místo ve výběrech; sloučení modelek převede obálky
  a sloučí odkazy.
- Smazání hlavní modelky sdíleného alba ho předá další modelce; profil se po úpravě sdíleného alba překreslí,
  smazání sdíleného alba varuje.
- Alt + šipka vlevo už nelistuje modelkami, šipky nefungují při výběru fotek ani nad otevřenou nabídkou, Esc
  nezruší neviditelný výběr, klávesy prohlížeče neplatí při psaní do pole.
- Hledání z profilu nebo stránky vydání hledá modelky a Zpět vrací tam, odkud se hledalo.
- „Uložit a další“ prochází pevnou frontu modelek, kterým chybí právě daný údaj.
- Nad poškozenou databází nebo databází z novější verze běží program jen pro čtení.
- Kontrola dostupnosti nevyhladoví na trvale nedostupných fotkách a zapisuje v jedné transakci; ověřená fotka
  si při vložení uloží datum. Šablona adresy obrázků se před uložením ověří na fotce ze sbírky.
- Řazení a hledání s písmeny jako Ł, Ø, ß stejně v databázi i v rozhraní („Émilie“ už se neřadí za Z).
- Zastaralá odpověď už nepřepíše mezipaměť přehledu.

## [0.9.0] – 2026-10-14

Etapa 6 roadmapy: vydání a vazby. Schéma databáze: úprava č. 5. Formát exportu: verze 3.

### Přidáno
- Údaje čísla časopisu: poznámka, modelka z obálky a stav „sháním / nezajímá mě“ (Upravit číslo… na stránce
  vydání, pravé tlačítko v kalendáři). Kalendář chybějící čísla podle stavu zvýrazní nebo ztlumí,
  Přehled čísla „nezajímá mě“ nedoplňuje. Profil modelky ukazuje, na kterých obálkách je.
- Odkazy u modelky (Wikipedie a podobně), v profilu jako štítky s názvem webu.
- Vlastní výběry fotek napříč modelkami: „Do výběru…“ u vybraných fotek a v nabídce fotky, prohlížení
  a správa v přehledu Nejlepší.
- Export a import zahrnují údaje čísel, výběry a odkazy.

## [0.8.0] – 2026-10-14

Etapa 5 roadmapy: prohlížení napříč sbírkou. Schéma databáze ani formát exportu se nemění.

### Přidáno
- Přehled Nejlepší: fotky s 3, 4 nebo 5 srdíčky napříč sbírkou po modelkách, s lištou modelek a slideshow.
- Stránka ročníku: všechna čísla roku po měsících i pictorialy přiřazené jen k ročníku; otevírá se
  klikem na rok v kalendáři.
- Stránka fotografa: jeho alba napříč modelkami chronologicky; otevírá se klikem na „Foto:“ u alba.
- Stěna centerfoldů podle vydání jako časová osa s lištou desetiletí.
- Zamíchané pořadí v prohlížeči (tlačítko nebo klávesa S), nastavitelný interval slideshow, náhodná modelka.

## [0.7.0] – 2026-10-14

Etapa 4 roadmapy: sbírka o stovkách modelek. Schéma databáze: úprava č. 4.

### Přidáno
- Zpět s historií: vrací tam, odkud se přišlo, i na stejné místo stránky; Alt + šipka vlevo.
- Lišta písmen A–Z nad galerií (od 20 modelek).
- Cílené hledání `pole:hodnota` (`vlasy:`, `fotograf:`, `rok:`, `narozena:`, `edice:`, `tag:`…).
- „Uložit a další“ ve formuláři modelky otevřeném z Přehledu.
- „Netýká se“ u chybějících údajů v Přehledu a přepínač pro zobrazení takto označených; stránkování tabulek.
- Šablona adresy obrázků v nastavení (⋯ → Adresa obrázků…).
- Verze programu v nabídce ⋯ a tento changelog.

### Změněno
- Kalendář sbaluje souvislé řady prázdných roků a načítá jeden řádek na vydání místo všech fotek.
- Kostra okna a sdílené prvky rozhraní jsou vyčleněné z `main.js` do `sablona.js` a `ui/`.

## [0.6.0] – 2026-10-14

Etapa 3 roadmapy: opravy bez mazání. Schéma databáze: úprava č. 3. Formát exportu: verze 2.

### Přidáno
- Album může patřit více modelkám; ukáže se v profilech všech.
- Přesun alba k jiné modelce, sloučení alb, sloučení duplicitních modelek.
- Výběr více fotek (Ctrl/Shift + klik): ohodnotit, přesunout do alba, odebrat.
- Tlačítko Vrátit po odebrání fotky.
- Otevřít fotku na Disku a kopírovat odkaz.
- Přejmenování fotografa nebo tagu v celé sbírce.

### Změněno
- Import běží v jedné transakci; při chybě se nezmění nic.
- Kontrola Disku si pamatuje stav u fotek, denně ověřuje dávku 300 nejdéle neověřených a odebrat nabízí
  jen opakovaně nedostupné fotky.

## [0.5.0] – 2026-10-14

Etapy 0–2 roadmapy. Schéma databáze: očíslované úpravy č. 1 a 2.

### Přidáno
- Denní záloha, obnovení ze zálohy z programu, zálohy rotované podle důvodu.
- Edice vydání (US a CZ, např. `2009-11-CZ`), přepínač edic v kalendáři.
- Přidávání ze stránky vydání a z prázdného políčka kalendáře, výběr modelky s našeptáváním
  a založením nové, „Uložit a přidat další album“.
- Převod amerických měr (5'7", 115 lbs, 34B-24-34), našeptávání fotografů z celé sbírky.
- Tlačítka + a ⋯ v hlavičce, Esc a Zrušit ve všech oknech, testy frontendu (`npm test`).

### Změněno
- Prohlížeč načítá obrázek podle velikosti okna, originál až pro lupu; menší náhledy, líné načítání plakátů.
- Hledání s prodlevou, bez ohledu na diakritiku jakéhokoli jazyka, zvlášť pro každý přehled.
- Stálé pořadí alb v profilu podle vydání.

### Opraveno
- Přidání fotek do existujícího alba mazalo jeho vydání.
- Dvojí kliknutí na Uložit vkládalo fotky nebo modelku dvakrát.
- Opožděná odpověď mohla při rychlém listování ukázat alba jiné modelky.
- Záloha se při chybě mohla tiše přeskočit; export mohl při chybě čtení zapsat prázdný soubor.
- Formulář modelky přepisoval prázdnou hodnotu, kterou nenabízel výběr.

### Zabezpečení
- Data, zálohy a export jsou čitelné jen pro vlastníka účtu; zámek jediné instance.

## [0.4.0] – 2026-10-14

### Přidáno
- Přehled sbírky: počty, tabulky toho, co chybí, ročníky, údaje ke kontrole.
- Zámek programu heslem.
- Zapamatování velikosti okna a posledního přehledu.
- Datum přidání u nových modelek a fotek.

## [0.3.0] – 2026-10-13

### Přidáno
- Ruční pořadí fotek v albu tažením, posun stránek spojeného plakátu.
- Export a import celé sbírky v YAML.

## [0.2.0] – 2026-10-13

### Přidáno
- Průvodní text a fotograf alba, hledání v textech alb.
- Lišty částí (alba v profilu, ročníky coverů, desetiletí kalendáře, alba v prohlížeči).
- Zkrácený náhled dlouhých alb, srdíčka u fotek, skok mezi alby v prohlížeči.
- Pictorial může patřit jen k ročníku bez měsíce.

### Změněno
- Přejmenování alba na název jiného alba téže modelky se odmítne (dřív se alba slila).

## [0.1.0] – 2026-10-13

První verze: katalog modelek s alby, centerfoldy a covery časopisů, fotky z Google Disku.

### Přidáno
- Galerie modelek s hledáním ve všech údajích, profil modelky s alby a prohlížečem fotek.
- Stěna centerfoldů, covery po ročnících, kalendář vydání a stránka vydání.
- Hodnocení modelek 1–5 srdíčky, rychlé přidání modelky jen jménem, formulář na záložkách.
- Zálohy před mazáním, kontrola dostupnosti souborů na Disku.

[0.9.1]: v0.9.1
[0.9.0]: v0.9.0
[0.8.0]: v0.8.0
[0.7.0]: v0.7.0
[0.6.0]: v0.6.0
[0.5.0]: v0.5.0
[0.4.0]: v0.4.0
[0.3.0]: v0.3.0
[0.2.0]: v0.2.0
[0.1.0]: v0.1.0
