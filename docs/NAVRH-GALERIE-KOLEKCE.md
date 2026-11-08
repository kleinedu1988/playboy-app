# Návrh: Kolekce v Galerii – sdružené fotky („řady“ jako ve streamovacích službách)

Stav k 8. 11. 2026 (verze 1.17.3). **Nic z toho není rozhodnuté** – návrh sbírá všechny možnosti, rozhodnutí
v oddílu 7.

## 1. Myšlenka

Galerie má dnes jednu mozaiku všech fotek (řazení a filtry) a hero banner s 8 fotkami z čela výběru. Návrh přidává
**kolekce** – pojmenované skupiny fotek, které program sestaví sám z dat sbírky, z obrazových modelů a z tvého
vkusu:

- **Hero banner** se nestřídá jen přes fotky, ale přes kolekce: nadtitulek = název kolekce („Tento měsíc
  v historii“, „Zrzky“, „Pláž za soumraku“), fotka = nejlepší fotka kolekce, tlačítko *Celá kolekce*.
- **Řady pod bannerem** (jako Netflix): 6–10 vodorovných pásů, každý jedna kolekce (název, počet, 10–15 fotek,
  šipky, *Zobrazit vše* → mozaika s kolekcí jako filtrem). Pod řadami dál celá mozaika.
- **Výběr kolekcí se střídá** podle dne, sezóny, toho, co jsi dělal naposledy, a jejich „síly“ (kolik fotek,
  jak se ti asi líbí, jak dlouho jsi je neviděl).
- **Chytré kolekce** jde uložit (jako vlastní výběr, ale samy se doplňují o nové fotky).

Každá kolekce = dotaz nad daty (filtr + řazení + popis „proč“). Většina jde postavit nad tím, co už program má
(galerie_fotek.go, obsah fotek, oblíbenost, zájem); několik potřebuje nový výpočet (oddíl 4).

## 2. Kolekce z dat sbírky (bez nového výpočtu)

### Čas a kalendář
| Kolekce | Z čeho | Poznámka |
|---|---|---|
| **Tento měsíc v historii** | vydání se stejným měsícem napříč roky („Listopady 1975–2024“) | každý měsíc jiná |
| **Výročí** | vydání přesně před 10/20/25/30/40/50 lety | „Před 30 lety: listopad 1996“ |
| **Rok** a **desetiletí** | vydání; „Rok 1995“, „Osmdesátky“ | střídat náhodně, preferovat nejlépe hodnocené roky |
| **Sezóna roku** | měsíc vydání (léto = 6–8…) + tag pláž/bazén | „Letní čísla“ v létě |
| **Narozeniny** | modelky narozené dnes / tento týden | „Dnes má narozeniny: …“ (+ věk) |
| **Výročí úmrtí** | `umrti_datum` | citlivě, jen jako vzpomínka |
| **Nově přidané** | `pridano` fotek za týden / měsíc | |
| **Dlouho neviděné** | zájem (`zajem`: kdy naposledy otevřený profil / prohlížené fotky) | připomenutí zapomenutých |
| **Věk při focení** | datum narození × datum alba | „Ve 20 letech“, „Po čtyřicítce“ |

### Modelka – vzhled (údaje modelky)
| Kolekce | Z čeho |
|---|---|
| **Blondýnky / Brunetky / Zrzky / Černovlásky** | `vlasy_barva` |
| **Barva očí** | `oci_barva` |
| **Národnost** (Češky, Skandinávky, Latinoameričanky…) | `narodnost` (seskupit do oblastí) |
| **Etnicita** | `etnicita` (jen jako filtr, ne jako doporučení – citlivé, viz NAVRH-DOPORUCENI) |
| **Postava**: přesýpací hodiny, štíhlé, vysoké, drobné | míry, poměr pas/boky, výška, BMI |
| **Prsa**: velikost, přírodní | `velikost_prsou`, `prsa_typ` |
| **Tetování / Piercing** | `tetovani`, `piercing` |
| **Ochlupení** | `ochlupeni` |

### Kariéra, časopis, autoři
| Kolekce | Z čeho |
|---|---|
| **Playmate měsíce / roku**, **Cyber Girl**, **Online** | kategorie (role) |
| **Centerfoldy**, **Obálky**, **Pictorialy** | typ alba |
| **Edice CZ / US**, **Moje výtisky** | edice, stav výtisku (Sháním CZ) |
| **Fotograf** („Dílo: Stephen Wayda“) | `alba.fotograf` (132 fotografů) |
| **Duo a skupiny** | sdílená alba (víc modelek) |
| **Série** (modelka ve více číslech) | počet vydání modelky |
| **Debuty** | první album modelky |

### Tvoje hodnocení a aktivita
| Kolekce | Z čeho |
|---|---|
| **Tvoje ♥5 / ♥4+** | srdíčka fotek |
| **Nedávno ohodnocené** | čas hodnocení (zápisy učení) |
| **Nejprohlíženější** | zájem (sekundy prohlížení) |
| **Vlastní výběry** | výběry |
| **Top 10 / Top 20 – jejich nejlepší fotky** | pořadí oblíbenosti |
| **Stoupající hvězdy** | trend oblíbenosti |
| **Síň slávy, tituly sezón** | kronika slávy, sezóny |
| **Aktuální tematická sezóna** | téma sezóny (soutěžící, fotky tématu) |
| **Dokonči album** | alba hodnocená jen zčásti |
| **Čeká na srdíčka** | nehodnocené (s nejvyšším odhadem napřed) |

## 3. Kolekce z obrazových modelů (CLIP, NudeNet, tagy) – data už spočítaná

| Kolekce | Z čeho |
|---|---|
| **Prostředí**: Pláž, Bazén, Studio, Ložnice, Koupelna, Příroda, Město, Auto | tagy + návrhy z obsahu (`obsah.NavrhnoutTagy`) |
| **Oblečení**: Bikiny, Šaty, Latex, Podpatky, Džíny, Kostýmy | tagy + návrhy |
| **Světlo**: Zlatá hodina, Noir (low-key), High-key, Noc | tagy + návrhy |
| **Černobílá** | návrh z obsahu (přesnost 100 %) |
| **Záběr**: celá postava, detaily | návrhy |
| **Odhalení**: oblečená, prádlo, nahoře bez, akt | detektor partií |
| **Portréty / pohled do kamery** | detektor (FACE_FEMALE) + CLIP |
| **Podobné jako …** | nejbližší sousedé vektoru (dnes „Podobné fotky“) |
| **Co se ti asi líbí** | odhad srdíček z obsahu (dnes výchozí řazení) |
| **Skryté poklady** | vysoký odhad, nehodnocené, málo prohlížené (zájem) |
| **Protože se ti líbila X** | sousedé fotek, které jsi nedávno dal ♥5 nebo dlouho prohlížel |
| **Modelky jako X** | průměrný vektor fotek modelky → nejbližší modelky |

## 4. Strojové učení – nové výpočty

| # | Kolekce / funkce | Metoda | Výpočet | Pracnost |
|---|---|---|---|---|
| 1 | **Objevené styly** – automatické skupiny fotek, které k sobě patří (např. „Retro studio 70. let“, „Pláž za soumraku“, „Černobílé akty“) | shlukování vektorů CLIP (k-means ~60 shluků, nebo HDBSCAN), název shluku zero-shot: nejbližší z několika set anglických popisů → český překlad | jednorázově ~10 s na 19 000 fotek, přepočet po novém obsahu | L |
| 2 | **Barevné palety** – „V červené“, „Modré tóny“, „Pastelové“, „Kontrastní“ | dominantní barvy náhledu (k-means v prostoru Lab na pixelech w400), uloženo vedle partií | ~5 ms na fotku, na pozadí s obsahem | M |
| 3 | **Kvalita snímku** – „Nejostřejší“, skrýt rozmazané a malé | ostrost (rozptyl Laplaciánu), rozlišení originálu, šum/komprese | ~3 ms na fotku | M |
| 4 | **Reprezentant focení** – jedna nejlepší fotka z každého alba (řada „Nejlepší snímek každého focení“) | v albu fotka s nejvyšším odhadem a nejbližší středu shluku alba | z existujících dat | S |
| 5 | **Téměř stejné snímky** (duplikáty, různé ořezy) – řada v Údržbě, v galerii skrýt opakování | podobnost vektorů ≥ 0,95 | z existujících dat | S |
| 6 | **Mimo tvou bublinu** – kvalitní fotky jiného stylu, než obvykle hodnotíš (průzkum vkusu) | vzdálenost od průměrného vektoru tvých ♥4+ × kvalita | z existujících dat | S |
| 7 | **Vývoj tvého vkusu** – „Letos se ti líbí víc …“ | srovnání odhadů na hodnoceních podle období | z existujících dat | M |
| 8 | **Hledání slovy česky** („červené šaty na pláži“) a z něj **chytré kolekce** | vícejazyčná textová věž CLIP (etapa 2 v NAVRH-OBSAH-FOTEK) | +135 MB modelu | L |
| 9 | **Kolekce podle nálady** (romantické, hravé, smyslné, elegantní) | zero-shot CLIP na popisy nálad + učení z tvých kliků na kolekce | z vektorů | M |
| 10 | **Osobní pořadí kolekcí** – které řady ukazovat nahoře | učení z toho, které kolekce otevíráš a kde dáváš srdíčka (jednoduchý bandit / skóre zájmu) | průběžně | M |
| 11 | **Doporučené alba** – „Tohle focení jsi ještě neviděl“ | průměrný odhad fotek alba × zájem | z existujících dat | S |
| 12 | **Pozice a kompozice** (vleže, sedí, zezadu, detail) přesněji | učení tagů z Průvodce (od 1.7.0) – kolekce se zpřesňují s tvým tagováním | průběžně | – |

Všechno se ukládá jako odvozená data vedle vektorů (`obsah/`), **beze změny schématu databáze i exportu**.

## 5. Výběr kolekcí na dnešek (algoritmus)

Každá kolekce má skóre: `zajimavost = velikost (log) × průměrný odhad/srdíčka × čerstvost (kdy naposledy
ukázaná) × kontext (den, měsíc, sezóna, narozeniny) × osobní váha (učení z kliků, #10)`. Na hero připadnou
3–5 nejlepších, do řad dalších 6–10; vždy aspoň jedna „průzkumná“ (styly, mimo bublinu) a aspoň jedna
z kalendáře. Kolekce s méně než 6 fotkami se neukazuje.

## 6. Rozhraní

- **Hero**: přepíná se přes kolekce (nadtitulek = název kolekce, fotka = její nejlepší), *Celá kolekce*, čárky
  a šipky jako dnes.
- **Řady**: název (+ proč: „Protože se ti líbila Heather Kozar“), počet, pás fotek s šipkami, *Zobrazit vše*.
- **Panel kolekcí** (pás pod lištou jako Filtry): všechny dostupné kolekce po skupinách (Čas, Vzhled, Kariéra,
  Obsah, Styly, Tvoje) s počty – kolekce jako rychlý filtr mozaiky.
- **Uložit jako chytrý výběr** u každé kolekce.
- Profil modelky: řada „Modelky jako ona“ a „Podobná focení“.

## 7. Rozhodnutí

1. **Rozsah první etapy** – doporučení: řady pod bannerem + hero přes kolekce z oddílů 2 a 3 (žádný nový
   výpočet), pak ML #4, #5, #6, #11 (malé), pak #1 Objevené styly a #2 Barevné palety.
2. **Kolik řad** na stránce (6 / 10 / jen hero a panel)?
3. **Etnicita a národnost** jako kolekce – jen národnost (oblasti), etnicitu jen ve filtru?
4. **Výročí úmrtí** – ukazovat, nebo ne?
5. **Hledání slovy (#8)** – stáhnout vícejazyčnou textovou věž (+135 MB)?

## 8. Etapy

| Krok | Obsah | Pracnost |
|---|---|---|
| 1 | Backend kolekcí: definice (dotaz + popis), výběr na dnešek, API `GetKolekceGalerie`, `GetFotkyKolekce` | M |
| 2 | Řady pod bannerem + hero přes kolekce + *Zobrazit vše* | M |
| 3 | Kolekce z dat (oddíl 2) a z modelů (oddíl 3) | M |
| 4 | ML malé: reprezentant focení, duplikáty, mimo bublinu, doporučená alba | M |
| 5 | Objevené styly (shlukování + pojmenování) | L |
| 6 | Barevné palety a kvalita snímku (výpočet na pozadí s obsahem) | M |
| 7 | Panel kolekcí, chytré výběry | M |
| 8 | Osobní pořadí kolekcí (učení z kliků), kolekce podle nálady | M |
| 9 | Hledání slovy česky (textová věž) | L |
