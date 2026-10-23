# Návrh: nápady k posouzení po 1.9

> **Číslování verzí:** návrh vznikl před revizí plánu 23. 10. 2026 a používá původní čísla verzí. Platné číslo
> je v tabulce verzí v [ROADMAP.md](../ROADMAP.md) (sloupec „Dřív“).

Stav k 22. 10. 2026 (verze 0.99.1). Rozpracování oddílu „Nápady k posouzení“ z `ROADMAP.md` do možností,
doporučení a cesty vývoje. Nic z toho není rozhodnuté; po potvrzení se vybrané verze přenesou do `ROADMAP.md`
(hotové sekce k vložení jsou na konci). Chytré hledání (1.9) rozpracovává `docs/NAVRH-HLEDANI.md`.

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export
(export je zmrazený na verzi 7 do 1.0; po 1.0 každá změna = nová úprava schématu a nová verze exportu,
1.6 už počítá s úpravou č. 12 a exportem 8, takže další volné je č. 13 / export 9).

## Výchozí stav v kódu

| Co | Kde | Pro nápady |
|---|---|---|
| Síť z Go | `klientDisku` (`http.Client`, 20 s) v `app.go`, `overitSouborNaDisku` stahuje náhled `w64` z šablony `adresaObrazku`; `overitSoubor` je vyměnitelná proměnná kvůli testům bez sítě | Wikidata i otisky fotek: stejný vzor (vlastní klient, vyměnitelná funkce, „neověřeno“ při výpadku) |
| Obrázky v rozhraní | `<img>` míří přímo na `lh3.googleusercontent.com` (`frontend/src/app/obrazky.js`, velikosti `w400`, `w600`…); program je nikde neukládá kromě mezipaměti WebKitu | Otisky potřebují pixely v Go → stáhnout znovu, nebo převzít z mezipaměti náhledů z 1.5 |
| CSP | `frontend/index.html`: jen `script-src 'self'; object-src 'none'; base-uri 'none'` | Obrázky ani `fetch` CSP neomezuje, ale dotazy na cizí služby patří do Go (User-Agent, mezipaměť, testy) |
| Zásady | `ROADMAP.md` → Nedělat: „stahování údajů z webu, rozpoznávání obličejů“; `PLAN.md`: bez připojení se fotky nenačtou, jinak vše funguje | Wikidata jsou s tímto bodem v rozporu → nutné vědomé rozhodnutí (viz nápad 1) |
| Odkazy na zdroje | `Modelka.Odkazy` (sloupec `odkazy`, jeden odkaz na řádek, „Wikipedie a podobně“) | Odkaz na Wikipedii/Wikidata = spolehlivé spárování; QID se dá uložit sem bez změny schématu |
| Nastavení | tabulka `nastaveni (klic, hodnota)`, `a.nastaveni()` / `a.ulozitNastaveni()` v `nastaveni.go` | Nový klíč není změna schématu; je v zálohách, ale ne v exportu |
| Kontrola a Údržba | `kontrola.go` (`kontrolovatSbirku`, nálezy `ok-…` ukládané do `netyka_se`), fronta v `frontend/src/app/prehled.js` (`FILTRY_UDRZBY`) | Nové filtry Údržby: „Z Wikidat“, „Stejné fotky“ |
| Souběžná práce | `kontrola_uceni.go` (jiná větev): `priznakyModelky`, `modelPostavy.vektor` (z-skóre postavy, robustní medián ± MAD), `jaroWinkler`, `podobnostModelek` | Podobné modelky, „jako X“ i párování s Wikidaty mají používat tytéž funkce |
| Výběry | `vybery (id, nazev, pridano)` + `vybery_fotky` (`vydani.go`), `GetVybery`, `GetFotkyVyberu`; v rozhraní `frontend/src/app/nejlepsi.js` jako čipy vedle „Nejlepší“ | Chytrý výběr = výběr s dotazem |
| Úvod Přehledu | `htmlUvodu` v `frontend/src/app/prehled-uvod.js` dostává `modelky` (s `centerfoldy`, `obalky`, `narozeniDatum`), `kalendar`, `stavy` | „Tento den“ jde spočítat bez nového volání backendu |

---

## 1. Doplňování údajů z Wikidat (návrh k potvrzení)

### Co to dá

- U modelky jedním klikem návrh chybějících údajů: datum narození a úmrtí, místo narození, národnost, výška,
  váha, barva vlasů a očí, pseudonymy, odkazy (web, Instagram, IMDb, Wikipedie).
- Upřesnění: ve sbírce `1967`, na Wikidatech `1967-07-01` → návrh přesnějšího data.
- Kontrola: ve sbírce 170 cm, na Wikidatech 173 cm → upozornění, nic se nemění samo.
- Hromadně v Údržbě: „centerfold bez data narození“ (krok 1.6) se z velké části vyřeší dávkou s kontrolou.

### Wikidata konkrétně

**Rozhraní:**

| Rozhraní | Adresa | Na co | Omezení |
|---|---|---|---|
| Hledání entit | `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=…&language=en&type=item&limit=10&format=json` | kandidáti podle jména a aliasů, s popisem („American model and Playboy Playmate“) | jen štítky a aliasy, žádné údaje |
| Hledání s podmínkou | `action=query&list=search&srsearch=haswbstatement:P166=Q… "jméno"` | jen položky s danou vlastností (např. ocenění Playmate) | QID ocenění ověřit v prototypu |
| Načtení entit | `action=wbgetentities&ids=Q1|Q2…&props=labels|aliases|descriptions|claims|sitelinks&languages=en|cs` | všechny údaje až 50 položek najednou | – |
| Podle článku | `action=wbgetentities&sites=enwiki&titles=Jméno_Příjmení` | QID z odkazu na Wikipedii v `Odkazy` (také `cswiki`, `dewiki`) | přesměrování: `&redirects=yes` |
| SPARQL | `https://query.wikidata.org/sparql?query=…&format=json` | celý katalog najednou (např. všechny Playmate měsíce s datem) | 60 s na dotaz, 60 s výpočtu za minutu na klienta, při zneužití 429/403 |

**Pravidla Wikimedie:** popisný `User-Agent` s kontaktem je povinný (obecné hlavičky dostávají 403), např.
`PlayboyDatabase/1.12 (osobní katalog; e-mail nebo adresa repozitáře)`; dotazy po jednom, `maxlag=5`,
při 429 čekat podle `Retry-After`. Pro osobní program s desítkami dotazů za minutu bez potíží.

**Licence:** data Wikidat jsou CC0 – smí se uložit do sbírky i exportu bez uvedení zdroje (odkaz na položku
se přesto uloží kvůli dohledatelnosti). Texty Wikipedie jsou CC BY-SA; samotná fakta (datum, výška) chráněná
nejsou, ale parsování textu je jiný problém (viz záloha níže).

**Vlastnosti a převod na údaje modelky:**

| Údaj (`sloupceModelky`) | Vlastnost | Převod |
|---|---|---|
| `narozeni_datum` | P569 datum narození | přesnost hodnoty 9/10/11 → `RRRR` / `RRRR-MM` / `RRRR-MM-DD` (přesně formát programu, `platneDatum`) |
| `umrti_datum` | P570 datum úmrtí | totéž |
| `narozeni_misto` | P19 místo narození (+ P17 stát místa) | český štítek, jinak anglický: „Ladysmith, Kanada“ |
| `narodnost` | P27 státní občanství | mapa QID státu → hodnota používaná ve sbírce (`USA`, `Česko`…); neznámý stát se jen ukáže, nenabídne |
| `vyska_cm` | P2048 výška | jednotka cm, m, palec, stopa → cm |
| `vaha_kg` | P2067 hmotnost | kg, lb → kg |
| `vlasy_barva`, `oci_barva` | P1884, P1340 | štítek → slovník hodnot ve sbírce (synonyma z 1.9) |
| `dalsi_jmena` | P742 pseudonym, P1477 rodné jméno, aliasy `en` | jen chybějící, sloučí se jako `sloucitSeznam` v `alba.go` |
| `odkazy` | sitelinks `enwiki`/`cswiki`, P856 web, P2003 Instagram, P345 IMDb + adresa položky | nové řádky na konec |
| `role` (kategorie) | P166 ocenění „Playboy Playmate of the Month/Year“ s kvalifikátorem P585 (datum) | jen ke kontrole proti centerfoldům a „Playmate roku RRRR“, nezapisuje se |
| `miry`, obvody, prsa, tetování… | nejsou modelované | – |
| `etnicita` | P172 | nenabízet (citlivé, řídce a sporně vyplněné) |
| titulní fotka | P18 obrázek na Commons | ne – fotky jsou jen na Disku |

Pozn.: P1559 (jméno v rodném jazyce) a P2002/P2013 (X, Facebook) mají malou hodnotu. Jak důsledně jsou
playmate na Wikidatech označené (P166, P106 povolání, popis), ověří první krok – odhad: stovky US playmate
s datem měsíce, s mezerami hlavně v 60.–80. letech.

**Spárování modelky s položkou** (skóre, nejsilnější první):

1. Odkaz na Wikipedii nebo Wikidata v `Odkazy` → jistá shoda.
2. Ocenění Playmate měsíce s P585 ve stejném měsíci jako centerfold (`Modelka.Centerfoldy`, edice US).
3. Shodné datum narození v přesnosti obou údajů; **rozporné datum kandidáta vylučuje**.
4. Podobnost jména s štítkem nebo aliasy (`jaroWinkler` z `kontrola_uceni.go`, práh ~0,92, bez diakritiky
   a pořadí slov jako `podobnostModelek`); u `DalsiJmena` stejně.
5. Popis obsahuje „Playboy“, „Playmate“, „model“, „glamour“.

Výsledek: **jistá** (1, nebo 2 + 4, nebo 3 + 4) → návrh rovnou; **možná** → uživatel vybere z 2–3 kandidátů
s popisem a datem narození; **žádná** → „Na Wikidatech nenalezeno“ s ručním vložením QID nebo odkazu.

### Možnosti

| Varianta | Výhody | Nevýhody |
|---|---|---|
| **A. Action API za běhu** (`wbsearchentities` + `wbgetentities`, po modelce) | jednoduché, malé dotazy, funguje i pro modelky mimo „Playmate“ (Cyber Girl, celebrity) | hromadně pomalejší (1–2 dotazy na modelku) |
| **B. SPARQL katalog** (jeden dotaz: všechny Playmate měsíce/roku s datem, narozením, výškou; uložit do mezipaměti) | párování podle měsíce centerfoldu je přesné; hromadné doplnění 1 dotazem | jen modelky s P166; složitější dotaz; WDQS bývá přetížená |
| C. Wikipedie, infobox | míry (`measurements`) tam bývaly | wikitext je křehký k parsování, šablony se mění a sjednocují, mnoho článků o playmate bylo smazáno nebo sloučeno do seznamů; CC BY-SA |
| D. Bez sítě – ruční vložení JSON z Wikidat | nulová síť | nikdo to dělat nebude |

**Soukromí a offline:** odchází jen jméno modelky (veřejná osoba), QID a IP adresa ke Wikimedii; žádná ID
z Disku, žádné fotky. Nic se neděje samo – jen po kliknutí. Bez připojení je volba vidět, ale ohlásí
„Bez připojení – Wikidata nejsou dostupná“, zbytek programu se nemění. Odpovědi se ukládají do
`~/.cache/playboy-app/wikidata/` (QID → JSON, 30 dní), takže opakované otevření návrhu síť nepotřebuje.

### Doporučení

**A pro jednotlivou modelku, B jako zrychlení hromadného doplnění v Údržbě; C ne** (jen ruční odkaz na
článek zůstává v `Odkazy`). **Bez změny schématu i exportu:** zapisuje se přes `UpdateModelka` (ověří
`overitDataModelky`), původ = řádek `https://www.wikidata.org/wiki/Q…` v `Odkazy`. Odmítnuté návrhy se
pamatují v `nastaveni` (klíč `wikidata_odmitnuto`, JSON `{modelkaID: {pole: hodnota}}`), aby se stejná
hodnota nenabízela znovu; nová hodnota na Wikidatech se nabídne.

**Rozhodnutí před začátkem:** bod „stahování údajů z webu“ v oddílu Nedělat upravit na „automatické
stahování a zápis údajů z webu“; doplňování z Wikidat jen na kliknutí a s potvrzením každého údaje.

### Data a algoritmy

- `wikidata.go`: `var stahnoutWikidata = stahnoutWikidataZWebu` (vyměnitelná jako `overitSoubor`),
  klient s `User-Agent`, `maxlag`, jedním dotazem naráz a mezipamětí na disku.
- `NavrhWikidat{QID, Popis, Shoda, Duvody []string, Pole []NavrhPole{Pole, Nazev, Ted, Navrh, Vychozi bool, Rozpor bool}}`.
- `NavrhnoutZWikidat(modelkaID) NavrhWikidat`, `KandidatiWikidat(modelkaID) []Kandidat`,
  `PrevzitZWikidat(modelkaID, qid, pole []string) bool` – načte modelku znovu, přepíše jen vybraná pole
  a vrátí původní stav pro „Vrátit“.
- Výchozí zaškrtnutí: prázdné pole → ano; přesnější datum se shodným začátkem → ano; rozdíl → ne, s ⚠.
- Hromadně: dávka modelek (např. „bez data narození“) → katalog B, zbytek A, max. 1 dotaz/s; výsledky
  jako fronta návrhů v Údržbě, zápis až po potvrzení.

### UI

```
Doplnit z Wikidat – Jana Ukázková                                     [×]
Položka Q123456 „Jana Ukázková“ – American model, Playboy Playmate
Shoda: Playmate měsíce 06/1995 · jméno · datum narození           [Jiná osoba…]

     Údaj        Ve sbírce        Wikidata
[x]  Narození    1974             1974-03-12        přesnější
[x]  Místo       –                Austin, USA
[ ]  Výška       170 cm           173 cm            ⚠ liší se
     Vlasy       blond            blond             stejné
[x]  Odkazy      1 odkaz          + Wikidata, Instagram, IMDb

Údaje z Wikidat (CC0). Uloží se jen zaškrtnuté.     [Zavřít] [Uložit vybrané (3)]
```

Kde: nabídka ⋯ v profilu („Doplnit z Wikidat…“), tlačítko v okně „Doplnit modelku“ (`doplneni.js`),
Údržba → filtr „Z Wikidat“:

```
Údržba · Z Wikidat (38)        [Zjistit návrhy pro 120 modelek bez data narození]  postup 64/120 · Pozastavit
Jana Ukázková    jistá shoda   narození 1974-03-12, místo Austin, USA          [Projít…] [Přijmout vše bez ⚠]
Eva Příkladná    možná (2)     vyber osobu                                      [Vybrat…]
```

Po uložení oznámení s „Vrátit“ (jako u odebraných fotek).

### Rizika

- Chybná shoda → zápis cizích údajů. Ochrana: rozporné datum vylučuje, výchozí zaškrtnutí jen u prázdných
  polí, „Vrátit“, denní záloha.
- Chyby na Wikidatech (výška v palcích zapsaná jako cm). Ochrana: nový údaj projde `kontrolovatPostavu`
  a naučenými rozsahy; mimo rozsah = ⚠ a nezaškrtnuto.
- Změna API nebo blokace bez `User-Agent`; přetížená WDQS → B je jen zrychlení, A stačí sama.
- Rozpor se zásadou „nestahovat z webu“ – vyřeší rozhodnutí výše.

### Jak otestovat

Odpovědi Wikidat jako soubory v `testdata/wikidata/` (vyměněná `stahnoutWikidata`): převod přesnosti data,
jednotek, státu; skóre shody (sitelink, měsíc, rozporné datum); `PrevzitZWikidat` mění jen vybraná pole;
bez sítě vrací „neověřeno“ a nic nezapíše. Ručně: 20 známých modelek z různých desetiletí, porovnat návrhy
s Wikipedií; dávka 100 modelek bez chyby 429.

**Pracnost:** L (dvě verze). **Schéma/export:** beze změny.

---

## 2. Podobné a duplicitní fotky na Disku

### Co to dá

- Stejná fotka nahraná na Disk dvakrát (jiné ID souboru) – dnes ji nenajde ani `kontrolovatDvojiceFotek`
  (hledá stejné `drive_file_id`), ani upozornění na duplicitu z 1.3 (také podle ID).
- Stejná fotka u dvou modelek nebo ve dvou albech (pictorial vs. centerfold z jiného zdroje).
- „Najít podobné“ u fotky: ostatní záběry ze stejného focení.
- Při vkládání odkazů upozornění „vypadá stejně jako fotka v albu X“.

### Možnosti

| Otisk | Jak | Odolnost | Cena |
|---|---|---|---|
| aHash | 8×8 šedá, bit = nad průměrem | slabá (jas, kontrast) | nejmenší |
| **dHash** | 9×8 šedá, bit = sousední pixel světlejší | dobrá na zmenšení a kompresi | malá |
| **pHash** | 32×32 šedá, DCT, 8×8 nízkých frekvencí bez DC, bit = nad mediánem | nejlepší na úpravy jasu, lehké ořezy, ostření | DCT 32×32, pořád ~ms |

Vše v čistém Go: `image/jpeg` a `image/png` ze standardní knihovny, kanál Y z JPEG (`image.YCbCr`) je
rovnou šedá, zmenšení vlastním průměrováním bloků (~30 řádků, bez `golang.org/x/image`). Disk přes `lh3` bez
hlavičky `Accept: image/webp` vrací JPEG (ověřit; jinak `golang.org/x/image/webp`).

**Odkud pixely:**

| Varianta | Výhody | Nevýhody |
|---|---|---|
| **A. Mezipaměť náhledů z 1.5** (`~/.cache/playboy-app/nahledy/`, `w400`) – co tam není, otisk stáhne do ní | jedno stažení slouží zobrazení i otisku, karty pak fungují offline | závisí na 1.5 |
| B. Vlastní stahování `w128` jen pro otisk | nezávislé, ~5 kB na fotku (64 000 fotek ≈ 320 MB přenosu) | druhé stahování, nic dalšího z toho není |
| C. Disk API `contentHash`/`md5Checksum` | přesná shoda bajtů | vyžaduje přihlášení a `drive.readonly`, nepozná přeuložený JPEG – ne |

**Kde otisky uložit:**

| Varianta | Výhody | Nevýhody |
|---|---|---|
| **Soubor v mezipaměti** `~/.cache/playboy-app/otisky.tsv` (`id⇥dhash⇥phash⇥verze`) | bez změny schématu, smazání = jen přepočet; 100 000 fotek ≈ 6 MB, načtení < 0,1 s | při přenosu na jiný počítač se počítá znovu |
| Sloupec `fotky.otisk` **[schéma]** | v záloze, dotazovatelné SQL | změna schématu kvůli odvoditelnému údaji; do exportu nepatří |

### Doporučení

**dHash + pHash (2 × 64 bitů), pixely z mezipaměti 1.5 (A), otisky v souboru mezipaměti, bez změny
schématu.** Dvojice „V pořádku“ (záměrně stejná fotka ve dvou albech) v `nastaveni` (`otisky_v_poradku`,
seřazené dvojice ID souborů).

### Data a algoritmy

- `otisky.go`: `otiskObrazku(img) (dhash, phash uint64)`, `vzdalenost = bits.OnesCount64(a ^ b)`.
- Prahy (doladit v kroku 1 na skutečné sbírce): **stejná** dHash ≤ 4 a pHash ≤ 6; **podobná** pHash ≤ 12.
- Výpočet na pozadí: fronta fotek bez otisku, 4 souběžná stažení (denní kontrola `velikostDenniDavky` má 300
  a 8 souběžně), pauza při 429 nebo výpadku, pokračuje při dalším spuštění. Dekódování 400px JPEG ~3–5 ms →
  64 000 fotek ≈ 1 min CPU; čas určuje síť (2,2 GB `w400` ≈ 20–40 min jednou, pak jen nové fotky).
- Vyhledání pro jednu fotku: hrubou silou přes všechny otisky (100 000 × XOR+POPCNT < 1 ms).
- Celá sbírka: všechny dvojice hrubou silou = 5·10⁹ porovnání ≈ 2–4 s na jádro – na pozadí přijatelné;
  rychleji **dělení na pásma** (pHash na 8 × 8 bitů: dvojice do vzdálenosti 7 se aspoň v jednom pásmu shodují
  přesně → porovnávají se jen fotky ze stejného koše, ~0,3 s). BK-strom není potřeba – víc kódu, stejný výsledek.
- Skupiny: sjednocení dvojic (union-find). „Podobné“ v rámci jednoho alba se nehlásí (série z focení),
  „stejné“ s různým ID ano.
- Otočení: `Rotace` je jen zobrazení; fotka uložená otočená má jiné pixely → u „stejných“ porovnat i pHash
  ze čtyř otočení matice 32×32 (levné). Ořez (spojené stránky centerfoldu, skeny) se nepozná – omezení.

### UI

Údržba → nový filtr „Stejné fotky“:

```
Údržba · Stejné fotky (7 skupin)        Otisky: 41 200 z 64 000 fotek · počítá se na pozadí [Pozastavit]
┌──────────┐ ┌──────────┐
│  náhled  │ │  náhled  │   shodné (vzdálenost 2)
└──────────┘ └──────────┘
Jana Ukázková            Jana Ukázková
Pictorial „Pláž 1995“    Centerfold 1995-06
[Odebrat] [Album]        [Odebrat] [Album]                    [V pořádku – ponechat obě]
```

Odebrání přes `OdebratFotky` s nabídkou „Vrátit“ (`ObnovitFotky`). V nabídce fotky (`akce-fotky.js`)
„Najít podobné fotky“ → mřížka seřazená podle vzdálenosti. Při vkládání (`AddBulkPhotos`, okno duplicit z 1.3)
druhá skupina „vypadá stejně jako…“ – jen když je otisk nové fotky do pár sekund k dispozici, jinak se vložení
nezdržuje.

### Rizika

Falešné shody u podobných pozadí a bílých plakátů (proto dva otisky a „V pořádku“); zátěž Disku (omezení
souběhu, pauza při 429); mezipaměť náhledů nad limitem 1 GB vymaže soubory, otisky zůstanou. Nejde
o rozpoznávání obličejů – porovnává se celý obrázek, ne osoba.

### Jak otestovat

Testovací obrázky v `testdata/otisky/` (originál, zmenšený, přeuložený JPEG s kvalitou 60, zesvětlený,
otočený, jiná fotka ze série, úplně jiná): vzdálenosti v očekávaných pásmech; pásma najdou stejné dvojice
jako hrubá síla na 10 000 náhodných otiscích; přerušené počítání pokračuje; bez sítě „neověřeno“.

**Pracnost:** M–L. **Schéma/export:** beze změny. **Závisí na:** 1.5.

---

## 3. „Podobné modelky“ v profilu

### Co to dá

Pod profilem 6 karet „Podobné modelky“ s důvodem: „90. léta · blond · 170 cm · stejný fotograf (Arny Freytag)“.
Objevování ve vlastní sbírce, rychlé porovnání, matoucí odpovědi pro kvíz (nápad 6). Hledání `jako:"jméno"`
z 1.9 (krok 4) je totéž jako seznam – **jedna funkce pro oba**.

### Vektor modelky

| Skupina | Údaje | Podobnost | Váha |
|---|---|---|---|
| Postava | výška, váha, hrudník, pas, boky, BMI | z-skóre z `modelPostavy` (`kontrola_uceni.go`), 1 − min(1, \|Δz\|/3) | 3 |
| Vzhled | vlasy, oči, `prsa_typ`, `ochlupeni`, tetování, piercing | shoda po sjednocení (synonyma z 1.9) | vlasy 2, oči 1, ostatní 0,5 |
| Původ | `narodnost`, `etnicita` | shoda | 1, 0,5 |
| Období | rok prvního vydání (`prvniVydani` v `kontrola.go`) | Gaussovo jádro, σ = 5 let | 2 |
| Kategorie | `kategorieModelky` (Playmate měsíce/roku, Cyber Girl…) | Jaccard | 1 |
| Fotografové | fotografové alb (`fotografoveAlb`) | Jaccard | 1,5 |
| Štítky | `tags` | Jaccard | 1 |

Chybějící údaj se nepočítá a váhy se přepočtou (Gowerova podobnost); modelka s méně než třemi společnými
skupinami se nenabízí. Důvody = tři skupiny s největším příspěvkem.

### Možnosti

| Varianta | Výhody | Nevýhody |
|---|---|---|
| **A. Pevné váhy, kNN hrubou silou v Go** | 2 000 modelek × 15 údajů = zlomek ms; vysvětlitelné | váhy odhadem |
| B. Váhy učené z chování (co uživatel z „podobných“ otevírá, krok 3 v 1.9) | přizpůsobí se | potřebuje data, nejdřív A |
| C. Vektor z fotek (obrazový model) | „vypadá podobně“ | velký model, nepatří sem (Nedělat) |

### Doporučení

**A**, sdílený soubor **`podobnost.go`**: `vektorModelky(m, uceni)` (postava z `naucitSe`/`modelPostavy`),
`podobnostVektoru(a, b) (skore, duvody)`, `PodobneModelky(id, n) []PodobnaModelka`. Hledání `jako:` v 1.9
volá tutéž funkci a jen výsledek filtruje dalšími podmínkami. Pokud 1.9 vyjde dřív, vznikne `podobnost.go`
už tam a 1.10 přidá jen profil. Model postavy se počítá jednou za načtení modelek (mezipaměť v `App`,
zneplatnění při `UpdateModelka`/importu).

### UI

```
Podobné modelky                                               Další podobné →
[karta] Eva Příkladná      [karta] …        [karta] …
        90. léta · blond · stejný fotograf
```

Klik otevře profil (s historií Zpět), „Další podobné →“ = galerie s `jako:"Jana Ukázková"`. Prázdný stav:
„Málo údajů k porovnání – doplň výšku, vlasy nebo vydání.“ Načítá se až po zobrazení profilu (kostra).

### Rizika a test

Riziko: dominance jedné skupiny (období) → test, že modelka bez postavy nedostane jen „stejné desetiletí“.
Testy: syntetická sbírka (dvojčata v údajích → první místo), chybějící údaje, symetrie, deterministické pořadí;
zátěž 2 000 modelek < 10 ms.

**Pracnost:** M (S, když `podobnost.go` vznikne v 1.9). **Schéma/export:** beze změny.

---

## 4. Tento den v historii

### Co to dá

Karta na úvodu Přehledu: kulatá výročí centerfoldů a obálek v tomto měsíci, dnešní a blízké narozeniny,
výročí českých čísel z vlastní sbírky výtisků. Malé potěšení při každém otevření, nic se nemusí zadávat.

### Pravidla

- **Čísla jsou měsíční** (`RRRR-MM`), den vydání sbírka nezná → výročí čísel platí celý měsíc.
- **Kulaté výročí:** 10, 20, 25, 30, 40, 50, 60, 70 let (násobek 10 nebo 25); ostatní centerfoldy měsíce
  jen jako řádek čipů let („Další říjnové centerfoldy: 1976 · 1983 · 1999 …“), klik otevře číslo.
- **Obálky:** `Modelka.Obalky`, stejné pravidlo; cover bez modelky ze sbírky (`naObalce`) jen kulaté.
- **Česká edice:** výročí čísel s výtiskem („Před 10 lety vyšlo 10/2016 – máš výtisk“) nebo sháněných.
- **Narozeniny:** jen úplné datum `RRRR-MM-DD`; dnes + nejbližších 7 dní („za 3 dny“); věk, kulaté
  (30, 40, 50…) zvýrazněné. U zemřelých (`UmrtiDatum`) se narozeniny neukazují (volitelně jen kulaté
  „nedožité“, střídmě). Narození 29. 2. se v nepřestupném roce ukáže 28. 2.
- **Přidáno do sbírky:** „Před rokem jsi přidal…“ z `pridano` (volitelné, jen když něco je).

### Možnosti

| Varianta | Výhody | Nevýhody |
|---|---|---|
| **A. Jen rozhraní** – výpočet v `prehled-uvod.js` z `modelky`, `kalendar`, `stavy`, které `htmlUvodu` už má | žádné volání backendu, žádné schéma, ~150 řádků | logika v JS bez testů v Go |
| B. `GetVyroci(datum)` v Go | testovatelné v `app_test.go` | další volání a typ, data už rozhraní má |

### Doporučení

**A**, čistá funkce `vyrociDne(dnes, modelky, kalendar, stavy)` v `frontend/src/lib/` s jednoduchými
testy v Node (jako ostatní pomocné funkce v `lib`), datum jako parametr kvůli testům. Bez sítě funguje
(fotky jen s „Nenačteno“, s 1.5 i obrázky).

### UI

```
Dnes 22. října
  Před 50 lety · 10/1976 · Playmate měsíce [foto] Jana Ukázková            →
  Před 25 lety · 10/2001 · obálka [foto] Eva Příkladná                     →
  Další říjnové centerfoldy: 1983 · 1990 · 1999 · 2007
  Narozeniny: dnes Petra Vzorová (50) · za 3 dny Lucie Testová (34)
  Česká edice: před 10 lety 10/2016 – máš výtisk
```

Umístění: hned pod řádkem KPI, šířka jedné karty. **Prázdné stavy:** nic dnes ani tento měsíc → jedna řádka
„Nejbližší výročí: 11/1985 (40 let) · nejbližší narozeniny: Eva P. za 12 dní“; žádná data narození →
„Doplň data narození v Údržbě“ s odkazem; prázdná sbírka → karta se nezobrazí.

### Rizika a test

Malá: časové pásmo (vždy místní datum), přelom roku u „za 7 dní“, 29. 2. Testy funkce s pevnými daty
(31. 12., 29. 2., kulatá/nekulatá výročí, zemřelá modelka, modelka jen s rokem narození).

**Pracnost:** S. **Schéma/export:** beze změny.

---

## 5. Chytré výběry z uloženého hledání

### Dnes

Výběr je ruční seznam fotek: `vybery (id, nazev, pridano)`, `vybery_fotky (vyber_id, fotografie_id, poradi)`,
přidává se z nabídky fotky (`pridatDoVyberu` v `nejlepsi.js`), prohlíží v přehledu Nejlepší jako čip vedle
„Nejlepší“ (`GetNejlepsiFotky(minHodnoceni)`). Export zná výběry (`exportVyberu`). Uložená hledání program
nemá; hledání fotek v Nejlepších filtruje v rozhraní (`vyhovujeHledani` nad `poleFotky`: jméno, fotograf,
vydání, rok, edice, hodnocení), hledání modelek v Go (`odpovidaHledani`).

### Co to dá

Výběr „Blondýnky 90. let ★4+“ = dotaz `vlasy:blond rok:1990..1999 srdicka:>=4`, který se plní sám, i fotkami
přidanými později. Další příklady: „Arny Freytag – centerfoldy“, „Česká edice 2015“, „Neohodnocené z posledního
měsíce“.

### Možnosti

| Varianta | Výhody | Nevýhody |
|---|---|---|
| **A. Sloupec `vybery.dotaz`** (NULL = ruční) **[schéma]**, export `vybery[].dotaz` | výběr je jeden pojem, projde zálohou i exportem | úprava schématu č. 13+, export 9+ |
| B. Uložená hledání v `nastaveni` (JSON) | bez migrace | export je nezná → ztráta při přenosu exportem; dva druhy „výběrů“ |
| C. `localStorage` v rozhraní | nejjednodušší | data, ne pohodlí – může zmizet; nedělat |

**Vyhodnocení dotazu:** v rozhraní by znamenalo načíst všech 64 000 fotek (megabajty JSON) → **v Go**:
`GetFotkyDotazu(dotaz)` = modelky podle `odpovidaHledani` (údaje modelky) + podmínky fotky (`srdicka`, `typ`,
`rok`, `vydani`, `edice`, `fotograf`, `album`, `pridano`) v SQL nad pohledem `fotografie`. Rozklad dotazu
na tokeny v Go je potřeba i pro 1.9 („česká věta jako filtr“) – sdílet, ne psát dvakrát.

### Doporučení

**A**, až po 1.9 (sdílený rozklad dotazu v Go). Úpravu schématu spojit s jinou plánovanou (1.6 nebo
„mám PDF“), pokud se termíny potkají – jedna verze exportu místo dvou. Starší program novější databázi otevře
jen pro čtení a novější export odmítne (už umí), takže stačí MINOR.

### UI

```
Nejlepší  [Nejlepší ★4+] [Dovolená] [⚡ Blond 90. léta 312] [⚡ Arny Freytag 88]      přejmenovat · upravit dotaz · zmrazit · smazat
```

- V liště Nejlepších při neprázdném hledání tlačítko „Uložit jako chytrý výběr…“ (název přes `vybratHodnotu`).
- Chytrý výběr má ikonu ⚡, dotaz je vidět a jde upravit; počet se dopočítá po načtení (čip nejdřív bez čísla).
- „Zmrazit“ = zkopírovat aktuální fotky do `vybery_fotky` a smazat dotaz (z chytrého ruční).
- Do chytrého výběru nejde ručně přidat fotku (v `pridatDoVyberu` se nenabízí).
- Řazení: hodnocení sestupně, pak vydání; načítání po dávkách jako dnes Nejlepší.

### Rizika a test

Dotaz zapsaný starší syntaxí po změně v 1.9 → dotaz se ukládá jako text a vyhodnocuje vždy aktuálním
rozkladem; neznámý klíč = hláška ve výběru, ne prázdný výsledek. Testy: `GetFotkyDotazu` proti stejnému
filtru v rozhraní na testovací sbírce; přechod schématu a export → import tam a zpět s chytrým výběrem;
`TestPrechodZeStarychVerzi` dál projde.

**Pracnost:** M. **Schéma/export:** ano (**[schéma]**).

---

## 6. Kvíz „Poznej playmate“

### Co to dá

Hra nad vlastní sbírkou: učení jmen a období, odhalí modelky bez fotky nebo s chybným datem (vedlejší
efekt pro Údržbu). Žádná data navíc.

### Režimy

| Režim | Otázka | Odpovědi | Zdroj |
|---|---|---|---|
| Kdo je to? | titulní fotka (s výřezem `coverZoom/X/Y`) nebo dlaždice centerfoldu | 4 jména | `adresaTitulni`, `centerfoldy` |
| Kdy? | fotka nebo jméno | 4 roky, nebo přesný měsíc/rok (3 body přesně, 1 bod ±1 rok) | `Centerfoldy`, `Vydani` |
| Playmate měsíce | „Kdo byla Playmate 06/1995?“ | 4 titulní fotky | `GetKalendar` + `Centerfoldy` |
| Playmate roku | „Playmate roku 1998?“ | 4 fotky | `role` („Playmate roku RRRR“) |

**Obtížnost:** lehká = náhodné matoucí odpovědi; těžká = nejpodobnější modelky (`PodobneModelky` z nápadu 3,
stejné desetiletí a vlasy). **Okruh:** vše / desetiletí / edice / jen oblíbené (srdíčka ≥ 4). Otázku jen
z modelek s titulní fotkou a známým vydáním; jméno modelky v souboru ani v `alt` obrázku nesmí být.

### Možnosti uložení statistik

| Varianta | Výhody | Nevýhody |
|---|---|---|
| **A. `nastaveni` klíč `kviz` (JSON)** + dvě vazby `GetKviz`/`SetKviz` | v zálohách a se složkou dat, bez migrace | ne v exportu (u hry nevadí) |
| B. `localStorage` | nulová práce v Go | může zmizet; podle zásad jen pro pohodlí |
| C. Tabulka **[schéma]** | dotazovatelné | zbytečné |

Obsah: počet her, úspěšnost po režimech, nejlepší série, u modelky `{krabicka, spravne, spatne, naposledy}`.
**Opakování podle Leitnera:** chyba → krabička 1, správně → o krabičku výš; váha výběru otázky 1/2^krabička,
takže se častěji ptá na modelky, které uživatel plete. 2 000 modelek ≈ 60 kB JSON.

### Doporučení

**A**, výpočet otázek čistě v rozhraní (`frontend/src/app/kviz.js` + čisté funkce v `lib` s testy),
z `vsechnyModelky()` (mezipaměť); backend jen `GetKviz`/`SetKviz`. Začít režimy „Kdo je to?“ a „Kdy?“.

### UI

Nová část Přehledu v nabídce tlačítka Přehled (`CASTI` v `prehled.js`: „Kvíz“), hra přes celé okno:

```
Kvíz · Kdo je to?       otázka 4/10 · série 3 · těžká · 90. léta            [Esc konec]
            ┌──────────────┐
            │   fotka      │
            └──────────────┘
 [1] Jana Ukázková   [2] Eva Příkladná   [3] Petra Vzorová   [4] Lucie Testová
                       ✓ Správně – Playmate 06/1995         [Enter další] [Otevřít profil]
```

Klávesy 1–4, Enter, Esc (doplnit do přehledu zkratek `zkratky.js`). Konec: skóre, seznam chyb s odkazy na
profil. **Offline:** bez připojení jen režimy bez fotky („Kdy byla Playmate X?“) nebo, po 1.5, modelky
s náhledem v mezipaměti; hláška místo prázdných obrázků.

### Rizika a test

Malá sbírka (< 8 modelek s fotkou) → kvíz nabídne „Málo modelek“; dvojčata (společný centerfold) → obě jména
správně; obálka s vytištěným jménem prozradí odpověď (přednost má titulní fotka s výřezem). Testy generátoru:
4 různé odpovědi, správná mezi nimi, deterministické s pevným semínkem, Leitner posouvá krabičky.

**Pracnost:** M. **Schéma/export:** beze změny.

---

## Cesta vývoje

### Pořadí (hodnota × pracnost)

| Nápad | Hodnota | Pracnost | Poznámka |
|---|---|---|---|
| Tento den v historii | střední, denně vidět | S | bez závislostí, ideální rozjezd |
| Podobné modelky | střední | M (S po 1.9) | sdílí `podobnost.go` s „jako X“ |
| Stejné fotky | vysoká pro kvalitu dat | M–L | až po náhledech na disku (1.5) |
| Wikidata | vysoká pro údaje (data narození) | L | nutné rozhodnutí o zásadě Nedělat |
| Chytré výběry | střední | M | **[schéma]**, až po rozkladu dotazu v Go (1.9) |
| Kvíz | zábava | M | těží z podobných modelek a 1.5 |

| Verze | Obsah | Prac. | Závisí na | [schéma]? |
|---|---|---|---|---|
| 1.10 | Tento den v historii, Podobné modelky v profilu | S + M | 1.9 (krok 4 „jako X“) | ne |
| 1.11 | Stejné a podobné fotky (otisk obrázku) | M–L | 1.5 | ne |
| 1.12 | Wikidata I – návrh údajů u jedné modelky | M–L | rozhodnutí o bodu Nedělat | ne |
| 1.13 | Wikidata II – hromadné návrhy v Údržbě | M | 1.12 | ne |
| 1.14 | Chytré výběry | M | 1.9 | **ano** (úprava č. 13, export 9) |
| 1.15 | Kvíz „Poznej playmate“ | M | 1.10 (matoucí odpovědi), 1.5 volitelně | ne |

Pořadí 1.11–1.15 jde měnit; Wikidata mohou jít hned po 1.10, pokud uživatel rozhodne o zásadě dřív
a doplnění dat narození bude spěchat víc než stejné fotky.

### K vložení do ROADMAP.md

Řádky do tabulky verzí v „Po 1.0.0“:

```
| 1.10 | Tento den v historii, podobné modelky v profilu | 1.9 |
| 1.11 | Stejné a podobné fotky (otisk obrázku) | 1.5 |
| 1.12 | Wikidata I – návrh údajů u modelky | – (rozhodnutí) |
| 1.13 | Wikidata II – hromadně v Údržbě | 1.12 |
| 1.14 | Chytré výběry **[schéma]** | 1.9 |
| 1.15 | Kvíz „Poznej playmate“ | 1.10 |
```

Oddíly:

```markdown
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
```

### Nedělat

| Co | Proč |
|---|---|
| Hledání podle obsahu fotky („na pláži“, „v červeném“) obrazovým modelem (CLIP a podobné) | model stovky MB, běhové prostředí přes cgo nebo GPU, hodiny výpočtu na 64 000 fotek; varianta v cloudu = posílat fotky třetí straně. Shodně s ROADMAP |
| Rozpoznávání obličejů (i pro „podobné modelky“ nebo hledání stejné osoby na fotkách) | už v Nedělat; biometrie, velké modely; otisk obrázku porovnává celý obrázek, ne osobu |
| Automatický zápis z Wikidat nebo z Wikipedie bez potvrzení | chybné shody a chyby zdroje by tiše přepsaly ruční údaje |
| Parsování Wikipedie, IAFD, Babepedie, playboy.com | křehké, podmínky služeb, licence, mnoho článků o playmate smazáno; Wikidata CC0 stačí |
| Stahování obrázků z Commons (P18) do sbírky | fotky jsou jen na Disku (Rozhodnuto) |
| Vektorová databáze, knihovny strojového učení, rozšíření SQLite | 2 000 modelek a 100 000 otisků zvládne hrubá síla v Go za milisekundy až sekundy |
| Otisky v databázi nebo v exportu | údaj se dá kdykoli dopočítat; zbytečná změna schématu |
| Chytré výběry nebo statistiky kvízu v `localStorage` | jsou to data, ne pohodlí rozhraní; úložiště prohlížeče může zmizet |
| Online žebříček kvízu, sdílení výsledků | osobní program bez serveru |
