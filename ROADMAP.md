# Roadmapa

Sestaveno 14. 10. 2026 ze tří auditů kódu (backend a data, frontend, funkce a pracovní postupy).
Nálezy vycházejí ze čtení kódu a z měření na syntetických datech, ne z provozu; prahy „od kdy to vadí“
jsou odhady. Drobné nápady a rozhodnutí „nedělat“ zůstávají v `PLAN.md`.

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc.

## Etapa 0 – Pojistky dat (hotovo 14. 10. 2026)

Cíl: žádná běžná akce nesmí tiše zničit nebo ztratit data.

| Co | Proč | Prac. |
|---|---|---|
| Záloha a pojistka před „Odebrat nedostupné z databáze“ | Dnes maže po jedné bez zálohy; když Disk omezí požadavky, zmizí alba i s texty a srdíčky. Při podezřele velkém počtu nedostupných akci vůbec nenabízet. | S |
| Přidání fotek do existujícího alba nesmí smazat jeho vydání | Formulář volá uložení vydání vždy, i s prázdným rokem (`main.js`, odeslání formuláře alba) | S |
| Zablokovat tlačítko během ukládání | Druhý klik při pomalém ověřování odkazů vloží fotky nebo modelku dvakrát | S |
| Ochrana proti zastaralé odpovědi | Při rychlém listování modelkami může hlavička patřit jedné a alba jiné; úpravy pak jdou na špatnou modelku | S |
| Záloha se nesmí tiše přeskočit | Selže-li počítací dotaz, `zalohovat` vrátí úspěch a mazání pokračuje bez zálohy | S |
| Denní záloha při startu, rotace podle důvodu | Dnes záloha vzniká jen při mazání a jedna fronta 20 kusů se při úklidu zaplní za večer | S |
| Export nesmí zapsat prázdný soubor jako úspěch | Chyba čtení se dnes neprojeví; kontrolovat chyby a po zápisu porovnat počty | S |
| Zámek jediné instance, `busy_timeout`, kontrola databáze při startu | Dvě spuštěné instance nad jednou databází; poškozený soubor se ukáže jako prázdná sbírka | S |
| Formulář modelky nesmí tiše smazat hodnotu, kterou nezná | Hodnota mimo nabídku (typicky z importu) se uložením přepíše prázdnou | S |
| Soubory s daty jen pro vlastníka (práva 0600) | Export i zálohy jsou dnes čitelné pro všechny uživatele počítače | S |

## Etapa 1 – Základy, na kterých stojí zbytek (hotovo 14. 10. 2026 kromě kontroly typů)

Cíl: změny schématu jsou bezpečné, program snese růst sbírky a frontend má první testy.
Kontrola typů ve frontendu je odložená do rozdělení `main.js` (etapa 4). Edice jsou u každého vydání
(cover, centerfold i pictorial) jako přípona: `2009-11` je US, `2009-11-CZ` česká edice.

| Co | Proč | Prac. |
|---|---|---|
| Číslované migrace (`user_version`) se zálohou předem | Podmínka všech dalších změn databáze | S–M |
| Index na fotky podle modelky a alba, jedinečnost souboru v albu | `GetModelky` při 500 modelkách a 20 000 fotkách: 0,35 s → pod 1 ms (měřeno v nativním SQLite) | S |
| Prohlížeč fotek: velikost podle okna, originál až pro lupu, brzda kolečka | Dnes vždy stahuje originál a přednačítá další; největší spotřeba paměti v programu | M |
| Líné načítání plakátů na stěně a v coverech, menší náhledy | Stěna a covery se stahují celé najednou; karty berou zbytečně velký obrázek | S |
| Prodleva u hledání, filtrování bez nového načítání | Každý stisk klávesy dnes znovu načte a přestaví celý pohled | S |
| Esc a tlačítko Zrušit ve všech oknech | Esc dnes nezavře žádné modální okno | S |
| Viditelná tlačítka „+“ a „⋯“ v hlavičce a u alba | Většina akcí včetně celé správy je jen pod pravým tlačítkem | M |
| Testy čistých funkcí frontendu a kontrola typů | Frontend nemá žádný test; pojistka před dělením `main.js` | S–M |
| Hledání a řazení i s cizí diakritikou | „Zoë“ se nenajde pod „zoe“ | S |
| Obnovení ze zálohy z programu | Ruční přepsání souboru za běhu hrozí poškozením a vrátí i staré heslo. Před obnovou se uloží současný stav, heslo zůstane současné. | M |
| Edice u vydání (US a CZ) | Sbírka obsahuje obě edice, ale vydání je dnes jen rok a měsíc: US a CZ číslo téhož měsíce se slijí do jednoho. Týká se coverů, centerfoldů, pictorialů, kalendáře, stránky vydání i exportu. Čím později, tím víc ruční opravy už zadaných dat. | L |

## Etapa 2 – Zakládání bez opakování (hotovo 14. 10. 2026)

Cíl: celé číslo časopisu se zpracuje z jedné stránky a nová modelka se čtyřmi alby se založí bez opakovaného psaní.

| Co | Proč | Prac. |
|---|---|---|
| Přidávání ze stránky vydání (cover, centerfold, pictorial) | Vydání se dnes zadává u každé položky znovu a přechází se mezi třemi pohledy | M |
| Výběr modelky s našeptáváním a „založit novou“ přímo v okně alba | Bez modelky je dnes nutné okno zavřít a začít jinde | S–M |
| „Uložit a přidat další album“, pamatovat fotografa a vydání | U nové modelky třikrát méně otevírání | S |
| Našeptávač fotografů z celé sbírky | Dnes bere jen alba naposledy otevřené modelky; stejné jméno se píše různě | S |
| Chytrá pole: stopy, libry, „34B-24-34“ | Odpadá ruční přepočet z amerických zdrojů | S |
| Prázdné políčko kalendáře nabídne i centerfold a pictorial | Kalendář jako vstup pro doplňování mezer | S |
| Alba v profilu ve stálém pořadí podle vydání | Dnes se pořadí alb změní po ručním seřazení fotek | S |
| Hledání zvlášť pro každý pohled | Text z Modelek dnes po přepnutí filtruje kalendář | S |
| Srozumitelná hláška na odkaz složky Disku | Dnes skončí jako „nefunkční odkaz“ | S |

## Etapa 3 – Opravy bez mazání

Cíl: fotka ve špatném albu, album u špatné modelky i duplicitní modelka se opraví bez nového vkládání odkazů a bez ztráty srdíček.

| Co | Proč | Prac. |
|---|---|---|
| Album jako samostatný záznam, covery bez zástupné modelky | Dnes je album jen shodný text u fotek: prázdné album nemůže existovat a text mizí s poslední fotkou. Zjednoduší všechno níže. | L |
| Více modelek u jednoho alba | Ve sbírce takové pictorialy jsou; dnes se musí vložit každé modelce zvlášť a srdíčka, pořadí i texty se rozejdou. Navazuje na album jako záznam. | L |
| Přesunout album k jiné modelce, sloučit dvě alba | Dnes jen smazat a vložit znovu | S–M |
| Výběr více fotek: odebrat, přesunout, ohodnotit | Jedna mechanika pokryje hromadné odebrání i přesun fotek | M |
| Zpět po odebrání fotky místo potvrzovacího okna | Rychlejší probírka alba a ochrana před omylem | M |
| „Otevřít na Disku“ a „Kopírovat odkaz“ u fotky | Program dnes odkaz nikde neukáže | S |
| Sloučit dvě modelky | Duplicitu dnes program jen ohlásí | M |
| Přejmenovat fotografa nebo tag v celé sbírce | Oprava nejednotného zápisu jednou akcí | S–M |
| Import a hromadné vkládání v jedné transakci | Po chybě uprostřed dnes zůstane půlka | M |
| Stav dostupnosti u fotky, kontrola Disku po dávkách | Fotka se neodebere po první neúspěšné kontrole; 20 000 požadavků denně by Google omezil | M |

## Etapa 4 – Sbírka o stovkách modelek

Cíl: ve stovkách karet se neztratíte a údaje se doplňují v řadě za sebou.

| Co | Proč | Prac. |
|---|---|---|
| Zpět na předchozí stránku a na stejné místo v galerii | Dnes Zpět vždy vede na začátek přehledu | M |
| Lišta písmen A–Z nad galerií | Skok na písmeno; od zhruba 50 modelek | S |
| Přepínač řazení galerie (nerozhodnuto, viz níže) | Naposledy přidané, podle roku prvního vydání, podle hodnocení, podle počtu fotek | S |
| Cílené hledání (`vlasy:blond`, `fotograf:…`, `rok:1975`) | Konec falešných zásahů bez lišty filtrů | S–M |
| Formulář modelky: „Uložit a další“ podle pořadí Přehledu | Doplňování bez návratů do tabulky | S–M |
| „Netýká se“ v Přehledu, stránkování místo limitu 60 | Modelka, která centerfold nikdy neměla, jinak svítí trvale | S–M |
| Kalendář: sbalit souvislé prázdné roky | Slabina zapsaná v `PLAN.md` | S–M |
| Rozdělit `main.js` na moduly | 3 000 řádků v jednom souboru; postupně, s testy z etapy 1 | L |
| Kalendář a přehled z agregovaných dat | Dnes se kvůli kalendáři posílá každá fotka přiřazená k vydání | M |
| Šablona adresy obrázku na jednom místě | Adresa Googlu je natvrdo na čtyřech místech; po změně na jejich straně je nutný nový build | S–M |

## Etapa 5 – Prohlížení napříč sbírkou

Cíl: pustit si to nejlepší, celý ročník, práci jednoho fotografa nebo náhodný výběr. Malé položky jdou vzít kdykoli dřív.

| Co | Proč | Prac. |
|---|---|---|
| Pohled „Nejlepší“: fotky s N a více srdíčky napříč sbírkou | Hodnocení fotek dnes slouží jen k řazení uvnitř alba | M |
| Stránka ročníku: vše z jednoho roku po měsících | „Co mám z roku 1975“ na jeden klik | S–M |
| Náhodná modelka, zamíchaná slideshow, nastavitelný interval | Znovuobjevování sbírky | S |
| Stěna centerfoldů chronologicky s lištou desetiletí | Stěna jako časová osa | S |
| Stránka fotografa | Až bude fotograf vyplněný u více alb | M |

## Etapa 6 – Vydání a vazby

Cíl: každé číslo má vlastní záznam s poznámkou a stavem. Navazuje na edice z etapy 1 a na album jako záznam z etapy 3.

| Co | Proč | Prac. |
|---|---|---|
| Vydání jako záznam: poznámka, modelka z obálky, stav „sháním / nezajímá mě“ | Kalendář rozliší mezeru od nezájmu | M–L |
| Odkazy u modelky | Zdroj údajů po ruce | S |
| Vlastní výběry fotek napříč modelkami | Až pohled „Nejlepší“ přestane stačit | M–L |

## Rozhodnuto 14. 10. 2026

- **Edice:** sbírka má US i CZ edici → edice u vydání zařazena do etapy 1.
- **Obnovení ze zálohy z programu:** ano → etapa 1.
- **Skupinové pictorialy:** ve sbírce jsou → více modelek u alba přesunuto z etapy 6 do etapy 3.
- **Místní kopie titulních fotek:** ne.
- **Zálohy na jiný disk:** ne.

## K rozhodnutí

1. **Přepínač řazení galerie.** Galerie se dnes řadí jen podle jména. Přepínač by umožnil „naposledy přidané“
   (co jsem zadal včera), podle roku prvního vydání (chronologický průchod), podle hodnocení a podle počtu fotek.
   Smysl má až od desítek modelek. Řazení zmizelo spolu se zrušenou lištou filtrů; samotný přepínač zamítnutý není.

## Nedělat

- Přihlášení k Disku a import celé složky přes OAuth.
- Automatické stahování údajů o modelkách z webu.
- Tagy a popisky u jednotlivých fotek.
- Strukturovaný obsah čísla (seznam článků).
- Tabulkový editor údajů v aplikaci – YAML v editoru a „Uložit a další“ dělají totéž.
- Rozpoznávání obličejů, více uživatelů, synchronizace, mobilní verze.
- Místní kopie fotek ani titulních fotek; zálohy na jiný disk.
- Vše z oddílu „Rozhodnuto nedělat“ v `PLAN.md`.
