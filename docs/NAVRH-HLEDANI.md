# Návrh: Chytré hledání (1.9)

> **Číslování verzí:** návrh vznikl před revizí plánu 23. 10. 2026 a používá původní čísla verzí. Platné číslo
> je v tabulce verzí v [ROADMAP.md](../ROADMAP.md) (sloupec „Dřív“).

Rozpracování bodu **1.9 – Chytré hledání (strojové učení nad sbírkou)** z `ROADMAP.md`. Stav k 22. 10. 2026.
Dokument je podklad k rozhodnutí; kód se podle něj začne psát až po 1.0.0.

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export.

## Shrnutí

- **Strojové učení = učení z vlastní sbírky a z používání**, ne velký jazykový model. Všechno běží v programu,
  bez internetu, bez nové závislosti a **bez změny schématu i exportu** (naučené údaje v tabulce `nastaveni`).
- Každá chytrá funkce se **převádí na dnešní dotaz** `pole:hodnota` (`vlasy:blond rok:1990..1999 tetovani:ne`).
  Ten se ukáže, jde upravit a vykoná ho stávající hledání – program nikdy nehledá „něco, co není vidět“.
- Doporučení: **ruční pravidla + slovník z hodnot sbírky** pro větu (žádný klasifikátor ani LLM),
  **předponový index v JS** pro našeptávač, **počítadla otevření s útlumem** pro učení,
  **vážená vzdálenost (Gower)** pro „jako X“ sdílená s kontrolou v Údržbě, **výchozí slovník + návrhy ze sbírky**
  pro synonyma.
- Pořadí: synonyma → našeptávač → věta I a II → „jako X“ → učení → návrhy synonym (1.9.0–1.9.6).

## Výchozí stav (co už je)

| Kde | Co dělá | Pro 1.9 |
|---|---|---|
| `app.go` `GetModelky(dotaz)` → `nactiModelky` | Při každém dotazu načte všechny modelky (5 souhrnných dotazů do SQLite) a každou propustí přes `odpovidaHledani` | Výkon roste s velikostí sbírky; nová logika smí přidat jen jednotky ms |
| `app.go` `odpovidaHledani` + `vzorSlovaHledani` | Slova AND, čárka OR, negace `-`/`!`, `pole:hodnota`, `pole:"víc slov"`, neuzavřené uvozovky | Cíl převodu věty; přibude jen klíč `jako:` a rozšíření synonym |
| `app.go` `poleHledani` | Klíče `jmeno, vlasy, oci, narodnost, etnicita, misto, tag, kategorie, vyskyt, fotograf, rok, vydani, narozena, edice, prsa, ochlupeni, poznamka, vyska, vaha, miry, hodnoceni/srdicka, tetovani, piercing, obalka, umrti` | Slovník věty mapuje jen na tyto klíče |
| `app.go` `parsovatNumerickyFiltr`, `vyhovujeNumericky` | `>`, `>=`, `<`, `<=`, `=`, `od..do`, `od-do` u `vyska, vaha, hodnoceni, rok, narozena`; `rok:197` = začátek roku | Rozsahy z věty („vyšší než 175“) se převedou sem |
| `app.go` `vzdalenostLevenshtein`, `maxPovolenaVzdalenost`, `odpovidaTextFuzzy` | Překlepy 0/1/2 podle délky slova, jen u jména a fotografa, ne u čísel a vylučovaných slov | Znovu použít pro jména fotografů ve větě a pro `jako:"jméno"` |
| `app.go` `zjednodusit` | Malá písmena bez diakritiky libovolného jazyka (NFD + `zvlastniPismena`) | Základ normalizace i „stemmingu“ |
| `frontend/src/lib/format.js` `rozlozitDotaz`, `vyhovujeHledani`, `ZNAME_KLICE`, `PRIKAZY` | Totéž hledání v JS pro Centerfoldy, Čísla, Kalendář, Nejlepší a našeptávač | **Dvě implementace** – každá změna (synonyma) musí do obou |
| `frontend/src/lib/format.js` `KATEGORIE` + `rozlozitKategorie` | Slovník aliasů („pmoy“, „cover girl“, „tvurkyne“…) po normalizaci, nejdelší alias první | Vzor pro slovník synonym a věty; kategorie z věty přes tytéž aliasy |
| `frontend/src/app/naseptavac.js` | Příkazy (`PRIKAZY`), hodnoty filtru s počty jen pro `vlasy, tag, narodnost, oci, kategorie, edice, vyskyt, tetovani, piercing, hodnoceni, rok` (roky natvrdo 1970–2010), modelky (5), články (FTS5), čísla | Základ pro 2; nemá historii ani pořadí podle používání |
| `frontend/src/app/navigace.js` `HLEDANI_PODLE_REZIMU` | Placeholder a nápověda pole podle přehledu; `hledaniPodleRezimu` drží dotaz každého přehledu | Nápověda se doplní o věty a `jako:` |
| `frontend/src/sablona.js` (`#searchInput` `title`, nápověda) | Text nápovědy hledání | Doplnit |
| `frontend/src/app/statistiky.js` | Podíl „Blond vlasy“ testuje `/blond|plav/` – synonymum natvrdo; výběr umí převést na dotaz („Otevřít v galerii“) | Přejít na společný slovník synonym |
| `nastaveni.go` `nastaveni` / `ulozitNastaveni` | Tabulka `nastaveni (klic, hodnota)` už ve schématu, mimo export | Úložiště naučených dat **bez změny schématu** |
| `frontend/src/app/backend.js` | Každé volání mimo `CTENI` po dokončení ohlásí změnu dat a zahodí mezipaměti | Zápis naučených dat **nesmí** ohlásit změnu dat (jinak se galerie při každém kliku načte znovu) |
| `vykon_test.go` `TestVykonVelkeSbirky` | 500 modelek, limit 2 s | Doplnit sbírku 5 000 modelek a limit pro nové části |

**Poznámka k výkonu:** cíl „hledání < 50 ms“ se týká přírůstku chytrých funkcí a odezvy při psaní. Prvním
krokem 1.9 je změřit dnešní `GetModelky` na 5 000 modelkách; pokud už sám přesahuje 50 ms, je to samostatná
oprava (mezipaměť načtených modelek v Go, zahozená při zápisu), ne součást chytrého hledání.

## Společné zásady

- **Průhlednost:** výsledek každé chytré funkce je vidět jako štítky „Rozumím:“ nebo jako vysvětlení
  („podobná: výška, blond, 90. léta“). Každý převod jde jedním klikem vrátit na doslovné hledání.
- **Nic se neztratí:** slovo, kterému převod nerozumí, zůstane v dotazu jako obyčejné hledané slovo (dnešní chování).
- **Učení jen řadí, nikdy neskrývá:** naučené údaje mění pořadí a návrhy, nikdy nevyřadí výsledek.
- **Soukromí:** žádné síťové volání, žádná telemetrie; naučené údaje jdou smazat (⋯ → Hledání → Zapomenout).
- **Jeden slovník pro Go i JS:** synonyma a výchozí slovník jsou JSON v Go (`//go:embed`), JS je dostane
  voláním při startu (stejně jako `nastavitNazvySpecialu`). Testovací případy hledání ve společném
  `testdata/hledani-pripady.json`, čtou je `app_test.go` i `frontend/test/lib.test.js` – obě implementace
  hledání se tak nerozejdou.

---

## 1. Česká věta jako filtr

**Co to dá:** napíšu, co hledám, jak bych to řekl, a program to převede na cílené hledání, které vidím.

| Věta | Převod | Výsledek |
|---|---|---|
| blondýnky z 90. let s tetováním | `vlasy:blond rok:1990..1999 tetovani:ano` | blond modelky s číslem v letech 1990–1999 a tetováním |
| zrzky vyšší než 175 narozené po 1980 | `vlasy:zrzava vyska:>175 narozena:>1980` | — |
| Češky bez tetování v české edici | `narodnost:ceska tetovani:ne edice:CZ` | „Češky“ = národnost, „česká edice“ = edice |
| playmate roku fotil Freytag | `kategorie:"playmate roku" fotograf:"arny freytag"` | jméno fotografa ze sbírky, skloňované |
| devadesátky kromě Američanek | `rok:1990..1999 -narodnost:americka` | negace jen na další pojem |
| Anna Nicole | beze změny | celý dotaz odpovídá jménu → nepřevádět |

### Možnosti

| | A: Pravidla + slovník ze sbírky | B: Malý místní klasifikátor | C: Jazykový model |
|---|---|---|---|
| Jak | Normalizace (`zjednodusit`), lehký stemming, ruční slovník ukazatelů (~150 kmenů: vlasy, období, čísla, negace, předložky) + slovník hodnot vytěžený ze sbírky (národnosti, fotografové, tagy, kategorie z `KATEGORIE`) + ~20 pravidel pro čísla a negaci | Naive Bayes nebo jednoduché značkování slov (CRF-like, příznaky: kmen, předchozí slovo, číslo) natrénované na párech věta → filtr vygenerovaných ze šablon a hodnot sbírky | Externí API (Claude, GPT) s popisem klíčů v promptu, nebo místní model (llama.cpp, 2–8 GB) |
| Offline / soukromí | ano | ano | API ne (dotazy i hodnoty sbírky odchází); místní ano |
| Velikost | desítky kB | stovky kB (váhy) + generátor | API 0, místní GB |
| Přesnost na doméně | vysoká u známých tvarů, nulová u neznámých (zůstanou textem) | podobná jako A – zná jen to, co je v šablonách; lepší jen u nečekaného slovosledu | nejvyšší u volných vět, občas si vymyslí klíč |
| Vysvětlitelnost | plná: každý štítek ví, které slovo ho vytvořilo a kterým pravidlem | slabá: „váha 0,73“ | žádná |
| Náročnost | M–L | L (generátor, trénink, ladění) | API S, ale klíč, cena, výpadky; místní L |
| Testovatelnost | deterministické, tabulka vět | deterministické po natrénování, chyby se těžko opravují | nedeterministické |

Šablony pro B by obsahovaly stejné znalosti jako pravidla v A, takže B přidá neprůhlednost bez nové informace.
C porušuje zásadu „nic neopouští počítač“ (API) nebo velikost programu (místní model).

**Doporučení: A.** „Učení“ je ve slovníku: hodnoty se berou ze sbírky (nová národnost nebo fotograf se naučí
sám po uložení) a z oprav uživatele (klik na štítek → „vždy takto“ uloží synonymum, viz 5). Případně později
přidat B jen jako záložní tipař pro nerozpoznaná slova (nabídka „Myslel jsi …?“), ne jako hlavní cestu.

### Data a algoritmy

Převod běží **v JS** (`frontend/src/lib/veta.js`, čistý modul bez DOM): má k dispozici `vsechnyModelky()`
z mezipaměti, výsledek je vidět při psaní bez volání backendu a testuje se `node --test`. Backend dostane už
jen kanonický dotaz – Go se nemění.

1. **Rozdělení a normalizace:** slova, čísla a tečky („90.“), `bezDiakritiky`, malá písmena.
2. **Lehký stemming bez slovníku tvarů:** odříznout nejdelší koncovku ze seznamu, jen když zbydou ≥ 3 znaky:
   `ovymi ovych ami ach ich ych ymi emi ovi eho ymu ova ove ou ky ka ek ce em a e i y o u`.
   Porovnání kmene s kmenem hodnoty: shoda, nebo společná předpona ≥ max(4, 0,7 × kratší kmen).
   Příklady: blondýnky → `blondyn` ~ `blond` ✓; zrzavé → `zrzav` ~ zrzavá ✓; Češky → `cesk` ~ česká ✓;
   Američanek → `americanek` → `american` ~ `americk` (předpona `americ`) ✓; Němky → `nemk` ✗ → proto
   **malý slovník obyvatel** (~25 dvojic Němka–německá, Britka–britská, Kanaďanka–kanadská…).
3. **Slovník ukazatelů** (JSON, Go `//go:embed` → JS):
   - vlasy: `blond, blondyn, plav, plavovlas, svetlovlas` → blond; `zrz, zrzav, rysav` → zrzavá;
     `brunet, hnedovlas, tmavovlas` → hnědá; `cernovlas` → černá,
   - období: `devadesat(k|a|ych)`, `90.`, `90s`, `90's` + volitelné „léta/let“ → `rok:1990..1999`
     (od padesátých po desátá; `nulta leta` → 2000..2009),
   - binární údaje: `tetovan`, `s tetovanim` → `tetovani:ano`; `netetovan`, `bez tetovani` → `tetovani:ne`;
     totéž piercing; `silikon` → `prsa:silikonova`; `prirodni prsa`; `oholen` → `ochlupeni:oholene`,
   - kategorie a výskyt: aliasy z `KATEGORIE` (`rozlozitKategorie` se použije přímo), `na obalce` →
     `kategorie:"modelka obalky"`, `jen online` → `vyskyt:online`,
   - srdíčka: `nejlepsi, oblibene` → `hodnoceni:>=4`; `pet srdicek` → `hodnoceni:5`,
   - výplňová slova se zahodí: `modelky, holky, zeny, playmates, ktere, co, jsou, maji, najdi, ukaz, z, ze, s, se, v, ve, a`.
4. **Slovník ze sbírky** (sestaví se z `vsechnyModelky()` při první větě a po `poZmeneDat`): kmeny hodnot
   `narodnost, vlasyBarva, ociBarva, etnicita, tags`, fotografové z alb (příjmení i celé jméno), kategorie.
   Každá položka: `{kmen, pole, hodnota, pocet}`; při shodě více polí vyhrává kontext, pak četnost.
5. **Čísla a rozsahy:** podle slova před/za číslem: `vyssi, vysoka, meri, cm` → `vyska`; `vazi, kg, lehci,
   tezsi` → `vaha`; `narozen*, nar.` → `narozena`; čtyřmístné číslo bez kontextu → `rok`. Porovnání:
   `nad, vic nez, vyssi nez, starsi nez` → `>`; `od` → `>=`; `pod, mene nez, nizsi nez` → `<`; `do` → `<=`;
   `mezi X a Y`, `X–Y`, `od X do Y` → `X..Y`; `po 1980` → `>1980`, `pred 1960` → `<1960`.
6. **Negace:** `bez, ne, krome, mimo` platí jen pro **nejbližší následující pojem** (`krome Americanek a Nemek`
   → obě, spojka „a“ v dosahu negace).
7. **Rozhodnutí, zda převádět:** pokud celý dotaz odpovídá jménu nebo pseudonymu (`odpovidaTextFuzzy` nad
   `jmeno + dalsiJmena`), nepřevádí se. Převod je **jistý**, když jsou všechna obsahová slova rozpoznaná;
   jinak je to jen nabídka.
8. **Výstup:** `[{slova:[0,1], klic, hodnota, negace, zdroj:'slovnik'|'sbirka'|'synonymum'|'oprava'}]`
   + nerozpoznaná slova → kanonický dotaz.

Složitost: věta má < 15 slov, slovník < 10 000 kmenů v `Map` podle prvních 3 znaků → < 1 ms. Sestavení
slovníku ze 5 000 modelek O(N × pole) ≈ 100 000 operací, < 20 ms jednou po změně dat.

### Uložení

Výchozí slovník je v programu (žádná data). Opravy uživatele („česká“ → vždy edice) jako synonyma v `nastaveni`
pod klíčem `hledani_synonyma` (viz 5). **Bez změny schématu i exportu.**

### UI

```
[ blondýnky z 90. let bez tetování                              × ]
  Rozumím:  [vlasy: blond ▾] [rok: 1990–1999 ▾] [tetování: ne ▾]   · 37 modelek
            Tab převést na dotaz · Ctrl+Enter hledat doslova
```

- Jistý převod se rovnou použije pro výsledky; řádek „Rozumím:“ je vidět stále. Nejistý jen nabídne
  („Myslíš: … ? Tab“) a hledá se doslova.
- Najetí na štítek zvýrazní slova věty, ze kterých vznikl. Klik (▾): jiný význam („česká: národnost / edice“),
  „Odebrat“, „Vždy takto“ (uloží opravu).
- **Tab** přepíše pole na kanonický dotaz (`vlasy:blond rok:1990..1999 tetovani:ne`) – uživatel se tak syntaxi
  učí; Tab se chytá jen při zobrazeném řádku, jinak dál přesouvá fokus. **Ctrl+Enter** = doslova. Esc zavře.
- Mimo přehled Modelky se použijí jen klíče, které pohled zná (`jmeno, fotograf, rok, edice, hodnoceni`);
  ostatní štítky jsou přeškrtnuté s titulkem „v tomto přehledu se nehledá“ (dnes je `ZNAME_KLICE` potichu ignoruje).
- Nápověda v `sablona.js` (title pole i oddíl Nápovědy) a `HLEDANI_PODLE_REZIMU`: příklad věty.

### Rizika a testy

- **Dvojznačnost** („česká“, „Playboy“, příjmení = běžné slovo): kontext, pak četnost, vždy viditelné a opravitelné.
- **„bez tetování“** = `tetovani:ne` najde jen modelky se zapsaným „ne“; štítek ukáže „+ 120 bez údaje“
  s volbou `-tetovani:ano` (bez tetování nebo neznámo).
- **„zemřelé“, „bez data narození“** nejde dnes vyjádřit. Volitelné malé rozšíření hledání: `pole:*` = vyplněno,
  `-pole:*` = nevyplněno (Go i JS, bez schématu). Do té doby zůstane slovo textem.
- **Falešný převod jména** (pseudonym jako „Kristina Blond“ by dal `vlasy:blond`) – pravidlo 7 a sada jmen v testu.
- Testy: `frontend/test/veta.test.js` s tabulkou vět → očekávaný kanonický dotaz.
  **Kritéria:** z 50 testovacích vět (10 vzhled, 10 období, 10 čísla a rozsahy, 8 negace, 6 fotograf
  a národnost, 6 kombinace) ≥ 45 přesně; 20 jmen modelek ze vzorové sbírky převod nezmění (0 chyb);
  žádné slovo věty se neztratí (každé je ve štítku nebo v textu); převod věty < 2 ms.

---

## 2. Našeptávač

**Co to dá:** při psaní vidím skutečné hodnoty ze sbírky s počtem modelek, i bez znalosti klíčů, a svá častá hledání.

| Píšu | Nabídka |
|---|---|
| `blo` | `vlasy:blond` · 412 modelek · `tag:blonde-bombshell` · 3 · modelky „Blossom…“ |
| `vlasy:blond fot` | `fotograf:"arny freytag"` · 58 **z výsledků** · `fotograf:"stephen wayda"` · 41 |
| (prázdné pole, fokus) | Naposledy: `kategorie:"playmate roku" rok:1990..1999` · Často: `edice:CZ hodnoceni:>=4` |

### Možnosti

| | A: Předponový index v JS | B: Návrhy z Go (`NavrhyHledani`) | C: Model doplňování z historie (n-gramy) |
|---|---|---|---|
| Jak | Z `vsechnyModelky()` seřazené pole `{klic, hodnota, kmen, pocet}`, binární hledání předpony; počty „z výsledků“ pro top návrhy | Totéž v Go, volání při každém stisku | Pravděpodobnost dalšího slova z vlastních dotazů |
| Offline / soukromí | ano | ano | ano |
| Velikost | < 1 MB v paměti | 0 v JS | malá |
| Přesnost | přesné hodnoty ze sbírky | stejná | jen co už jsem hledal |
| Vysvětlitelnost | počet u každé hodnoty | stejná | slabší |
| Náročnost | S–M (navazuje na `ziskatMoznostiHodnot`) | M + volání přes Wails při psaní | M |
| Testovatelnost | `node --test` | Go test | dobrá |

**Doporučení: A + historie s frecency** (četnost × čerstvost, jen z vlastních hledání). B nepřinese nic,
co JS nemá v mezipaměti, a přidá latenci volání. C je zbytečné při desítkách dotazů.

### Data a algoritmy

- `ziskatMoznostiHodnot` se nahradí obecným indexem pro všechna textová pole (`vlasy, oci, narodnost, etnicita,
  misto, tag, kategorie, fotograf, prsa, ochlupeni, vyskyt`); rok z dat (desetiletí od nejstaršího čísla, ne natvrdo 1970–2010).
- Hodnoty se seskupí podle `sjednotit` a podle synonym (5): „Blond / blonde / plavá“ = jeden řádek s celkovým počtem.
- Bez klíče: slovo `blo` hledá v kmenech všech polí; řadí se podle četnosti, s bonusem za jméno modelky.
- **Počty z výsledků:** u nejvýš 6 návrhů spočítat, kolik modelek *dnešních výsledků* hodnotu má
  (6 × 5 000 porovnání, < 5 ms); návrh s 0 se nezobrazí.
- Sestavení indexu O(N × pole) po `poZmeneDat`; dotaz O(log V + k). Odezva našeptávače < 30 ms po stisku
  (dnešní zpoždění 120 ms v `pripravit` zůstává).
- **Historie:** posledních 50 provedených dotazů (provedený = Enter, nebo otevřený výsledek, nebo 2 s bez psaní),
  `{dotaz, pocet, naposledy}`; skóre = pocet × 0,5^(dny/30).

### Uložení

`nastaveni` klíč `hledani_historie` (JSON, ≤ 50 položek, ~5 kB). Zápis přes novou vazbu (viz Společné části),
ne `localStorage`: historie přežije obnovení zálohy a přesun složky dat a vidí ji i Go test.

### UI

```
┌ Možnosti filtru vlasy ──────────────────────────────┐
│ 🏷 vlasy:blond      412 modelek · 37 z výsledků      │
│ 🏷 vlasy:hneda      388 modelek                      │
├ Hledala jsi ────────────────────────────────────────┤
│ ↺  kategorie:"playmate roku" rok:1990..1999     ✕    │
└ ↑↓ vybrat · Enter vložit · Delete smazat z historie ┘
```

Skupina „Hledala jsi“ jen při prázdném poli nebo shodě předpony; Delete na vybrané položce ji smaže.

### Rizika a testy

- Příliš mnoho řádků → limit 6 na skupinu jako dnes. Citlivost historie → mazání jednotlivě i celé.
- Testy: index ze vzorových modelek (`blo` → `vlasy:blond` první), seskupení synonym, počty z výsledků,
  frecency řazení. **Kritéria:** u 20 testovacích předpon je očekávaná hodnota mezi prvními 3; odezva < 30 ms
  na 5 000 modelkách (měření v `node --test` s vygenerovanou sbírkou).

---

## 3. Učení z otevíraných výsledků

**Co to dá:** co po hledání otevírám, jde příště výš – v našeptávači i v galerii s řazením „Relevance“.

| Situace | Dnes | Po 1.9 |
|---|---|---|
| `anna` → pokaždé otevřu Anna Nicole Smith | abecedně, 6. v pořadí | po 2–3 otevřeních první |
| `freytag` | abecedně | modelky, které po tomto dotazu otevírám, nahoře |
| nový dotaz `ann` | — | částečně z dotazu `anna` (shoda předpony) a z obecné obliby profilu |

### Možnosti

| | A: Počítadla dotaz → modelka s útlumem | B: Obliba profilu (bez dotazu) | C: Learning-to-rank (logistická regrese nad příznaky) |
|---|---|---|---|
| Jak | `kliky[normDotaz][id] = {n, den}`; skóre = log(1+n) × 0,5^(dny/90) | `otevreni[id]`, slabý bonus všude | Váhy pro shodu ve jménu, hodnocení, oblibu, kliky; učí se z otevřeno/neotevřeno |
| Soukromí | v počítači | v počítači | v počítači |
| Přesnost | výborná pro opakované dotazy | hrubá | lepší jen při tisících kliků |
| Vysvětlitelnost | „otevřela jsi 3× po ‚anna‘“ | „často otevíraná“ | slabá |
| Náročnost | S–M | S | L |
| Testovatelnost | deterministická | deterministická | horší |

**Doporučení: A + B jako slabší složka.** C má smysl až při datech, která jeden uživatel nevytvoří.

### Data a algoritmy

- **Normalizovaný dotaz:** `zjednodusit`, tokeny seřazené, bez `hodnoceni:`/řazení; `Anna  nicole` = `anna nicole`.
- **Záznam:** v `naseptavac.js` `otevrit()` (položka Modelky) a v galerii při otevření karty, když je v poli dotaz
  (`stav.nacteneModelky` + `searchInput.value`). Bez dotazu jen B.
- **Skóre řazení:** `zaklad` (shoda ve jménu > jinde, jak to dělá `naseptavac.js`) + 2 × kliky dotazu
  + 0,5 × kliky dotazů se stejnou předponou + 0,3 × log(1 + obliba) + 0,1 × hodnocení. Váhy v konstantách, testované.
- Kde: **JS** (pořadí našeptávače i galerie se řadí ve frontendu – `seraditModelky`); nová položka
  `RAZENI_GALERIE` „Relevance“ jen při neprázdném dotazu. Go se nemění.
- Velikost: max. 500 dotazů × 10 modelek a 2 000 profilů; nejméně použité se mažou → < 100 kB.
  Výpočet pořadí O(výsledky) s `Map` → < 2 ms.

### Uložení

`nastaveni` klíč `hledani_uceni` (JSON `{verze:1, dotazy:{…}, profily:{…}}`). Zápis s odkladem 2 s (dávkuje
kliky). Databáze jen pro čtení (`prepnoutJenProCteni`) → zápis tiše vynechán. V exportu ne – je to používání,
ne sbírka. Zálohy ho obsahují (je v databázi), obnovení zálohy ho vrátí – žádoucí.

### UI

- U modelky povýšené učením malá značka ↑ s titulkem „Otevřela jsi 3× po hledání ‚anna‘“.
- Kontextová nabídka karty v našeptávači: „Neupřednostňovat“ (smaže počítadlo pro tento dotaz).
- ⋯ → Hledání → „Zapomenout naučené pořadí (N záznamů)“.
- Řazení „Relevance“ v liště voleb; výchozí řazení se nemění, takže učení nikoho nepřekvapí.

### Rizika a testy

- **Zpětná vazba** (nahoře → víc kliků → víc nahoře): útlum, strop n = 20 a shoda ve jménu má vždy přednost.
- **Zápis při každém kliku** by přes `backend.js` zneplatnil mezipaměti → vazba patří mezi volání bez ohlášení.
- Testy: po 3 záznamech `anna` → X je X první; po 120 dnech skóre < polovina; „Zapomenout“ vrátí abecední
  pořadí; omezení velikosti. **Kritérium:** opakovaný dotaz najde naposledy otevíranou modelku do 3 pozic
  ve ≥ 90 % z 20 simulovaných relací.

---

## 4. „Jako X“ – podobné modelky

**Co to dá:** `jako:"Pamela Anderson"` najde modelky podobné postavou, vlasy, obdobím a kategorií, s vysvětlením.

| Dotaz | Výsledek |
|---|---|
| `jako:"pamela anderson"` | 30 nejpodobnějších, řazeno podle podobnosti, u karty „92 % · blond, 170 cm, 90. léta, Playmate měsíce“ |
| `jako:"dorothy stratten" -vlasy:blond` | podobné, ale ne blond (kombinace s dnešními filtry) |
| v profilu „Podobné →“ | totéž jedním klikem (bod z „Nápady k posouzení“) |

### Možnosti

| | A: Vážená vzdálenost (Gower) nad údaji | B: TF-IDF nad textem modelky | C: Vektory z chování (rozklad matice otevření/hodnocení) |
|---|---|---|---|
| Jak | Čísla (výška, váha, hrudník, pas, boky, BMI, pas : boky, rok narození, rok 1. čísla) normalizovaná mediánem a IQR sbírky; kategorické (vlasy, oči, národnost, etnicita, prsa typ, ochlupení, tetování, piercing) shoda 0/1; množiny (kategorie, tagy, fotografové) Jaccard. Chybějící údaj se vynechá a váhy se přepočtou | Kosinová podobnost slov tagů, poznámky, textů alb | Latentní vektory z toho, co otevírám a hodnotím |
| Offline | ano | ano | ano |
| Přesnost | dobrá u vyplněných údajů | zachytí texty, šum v poznámkách | potřebuje mnoho dat |
| Vysvětlitelnost | plná: 3 největší příspěvky | slova | žádná |
| Náročnost | M | S–M | L |
| Testovatelnost | deterministická | deterministická | slabá |

**Doporučení: A**, z B jen Jaccard tagů a fotografů jako jedna složka. C ne.

### Data a algoritmy

- Výpočet v **Go**: nový soubor `podobnost.go` – `vektorModelky(m Modelka) priznaky`, `statistikySbirky(modelky)`
  (medián, IQR), `podobnost(a, b, stat) (skore float64, duvody []string)`.
- `nactiModelky`: token `jako:` se vyjme z dotazu (v `odpovidaHledani` přibude `jako` mezi známé klíče, který nic
  neomezuje), cílová modelka se najde přes `zjednodusit` + `odpovidaTextFuzzy` (víc shod → ta s víc fotkami;
  štítek ukáže „jako: Pamela Anderson (1967)“). Ostatní slova filtrují jako dnes; výsledky se seřadí podle
  podobnosti, ořízne se na 30 nebo skóre ≥ 0,6, cíl sám se vynechá.
- `Modelka` dostane jen JSON pole `Podobnost float64` a `DuvodyPodobnosti []string` – export má vlastní
  `exportModelka`, takže se ho to netýká.
- Frontend: `seraditModelky` při `jako:` řadí podle `podobnost` (řazení „Podobnost“ v liště, automaticky);
  `PRIKAZY`, `ZNAME_KLICE`, nápověda doplněné.
- Složitost: 5 000 × ~20 příznaků = 100 000 operací, statistiky se počítají jednou při načtení → < 10 ms.
- Váhy (výchozí): postava 3, vlasy 2, období 2, kategorie 1,5, národnost 1, ostatní 0,5. Nastavitelné až když
  bude potřeba.

### Vztah ke kontrole v Údržbě (`kontrola.go`, souběžný `kontrola_uceni.go`)

Souběžná práce přidává naučená rozdělení (místo pevných `vyskaOd…bokyDo` v `kontrola.go`) a podobnost jmen.
Návrh: **jedno místo pro obojí**:

- `statistikySbirky` (medián, kvartily po údajích) = naučená rozdělení pro kontrolu i normalizace pro „jako X“.
- `podobnostJmen(a, b)` (po `zjednodusit`, Levenshtein poměrný k délce, prohozená slova) = kontrola duplicit
  (`kontrolovatJmena` dnes hledá jen stejné jméno), řešení `jako:"jméno"` i jména fotografů ve větě (1)
  a návrh sloučení fotografů z 1.6.
- **Duplicitní záznam** = podobné jméno **a** podobnost údajů ≥ 0,9 → nález „stejná modelka dvakrát?“ v Kontrole.

Kdo přijde první, vytvoří API; druhý ho použije. Podmínka: jedna normalizace jmen v celém programu.

### Uložení

Nic se neukládá; počítá se z dat při každém dotazu. **Bez schématu.**

### UI

```
Hledání: jako:"pamela anderson"        Řazení: Podobnost ▾
┌────────┐ ┌────────┐ ┌────────┐
│  foto  │ │  foto  │ │  foto  │
│ 92 %   │ │ 88 %   │ │ 85 %   │
└────────┘ └────────┘ └────────┘
 Jméno      Jméno      Jméno
 blond · 170 cm · 90. léta     ← titulek: tři největší důvody
```

V profilu tlačítko „Podobné →“ (nebo klávesa `P`) otevře galerii s `jako:"…"`.

### Rizika a testy

- Modelka s málo údaji → nízká jistota; pod 4 vyplněnými údaji štítek „málo údajů pro porovnání“.
- Míry v palcích vs. cm – údaje jsou už převedené (`prevestVysku`, `rozlozitMiry`), testovat na vzorové sbírce.
- Testy (`podobnost_test.go`): stejné údaje → 1,0; chybějící údaje nespadnou a nezvýhodní; cíl není ve výsledku;
  kombinace s `-vlasy:blond`; důvody seřazené. **Kritéria:** u 10 ručně vybraných modelek vzorové sbírky
  ≥ 7 z prvních 5 podobných označí uživatel za smysluplné; `GetModelky("jako:…")` na 5 000 modelkách přidá ≤ 10 ms.

---

## 5. Synonyma ze sbírky

**Co to dá:** „plavé“, „blond“ a „blonde“ (i zápisy z importu v angličtině) se hledají společně.

| Dotaz | Najde |
|---|---|
| `vlasy:blond` | Blond, Blonde, plavá, Platinová blond |
| `narodnost:usa` | Americká, USA, American |
| `zrzky` (věta) | Zrzavá, Red, Ryšavá |

### Možnosti

| | A: Ruční výchozí slovník | B: Návrhy vytěžené ze sbírky | C: Vektory slov (embeddingy) |
|---|---|---|---|
| Jak | ~40 skupin (barvy vlasů a očí cs/en, národnosti cs/en/zkratky, prsa, ochlupení) ve stylu `KATEGORIE.aliasy` | Hodnoty téhož pole podobné po `zjednodusit` + stemming + Levenshtein („Blond“/„blonde“/„blond.“); hodnoty, které uživatel v dotazu nahradí jinou do 30 s; opravy štítků z 1 | Podobnost slov z velkého korpusu |
| Offline | ano | ano | model desítky MB |
| Přesnost | vysoká, ale jen co se předvídá | dobrá, potřebuje potvrzení | nevhodná (blond ~ brunet) |
| Vysvětlitelnost | plná | „podobný zápis, 12 modelek“ | žádná |
| Náročnost | S | S–M | L |

**Doporučení: A jako základ + B jako návrhy k potvrzení.** Synonyma mění jen hledání, **nikdy data**;
sjednocení zápisu v datech je úkol pro Údržbu (přejmenování hodnoty), ne pro hledání.

### Data a algoritmy

- Formát: `[{pole:"vlasy", hodnoty:["blond","blonde","plava","platinova blond"], zdroj:"vychozi"|"potvrzeno", vypnuto:false}]`;
  `pole:"*"` platí pro hledání bez klíče.
- **Rozšíření dotazu v enginu**, ne v textu pole: Go `odpovidaHledani` (varianty po čárce už existují – synonyma
  se jen přidají do `varianty`) a JS `rozlozitDotaz`/`vyhovujeHledani` stejně. Slovník se načte při startu
  do paměti (Go jako `sablonaObrazku`, JS jako `nastavitNazvySpecialu`).
- Návrhy B: pro každé pole skupiny hodnot se stejným kmenem nebo vzdáleností ≤ 1 (u slov ≥ 5 znaků) – O(V²)
  pro V < 200 hodnot pole, < 5 ms; počítá se jen při otevření okna Synonyma.
- `statistiky.js` podíl „Blond vlasy“ (`/blond|plav/`) přejde na skupinu `vlasy:blond`.

### Uložení

Výchozí skupiny v programu; potvrzené, vypnuté a opravy z 1 v `nastaveni` klíč `hledani_synonyma`. Bez schématu,
mimo export (export verze 7 beze změny). Kdyby se jednou synonyma měla přenášet exportem, byla by to nová
verze exportu 8 **[schéma]** – zatím se nedělá.

### UI

```
⋯ → Hledání → Synonyma
  Vlasy:   blond = blonde = plavá = platinová blond     [upravit] [vypnout]
  Návrhy:  „Hnědá“ (388) ≈ „hneda.“ (2) ≈ „brown“ (14)  [sloučit pro hledání] [ne]
```

Ve štítku hledání: `vlasy: blond (+3)` – titulek vyjmenuje rozšíření, klik na „+3“ je vypne pro tento dotaz.

### Rizika a testy

- Příliš široké skupiny (hnědá ≈ hnědooká) → synonyma platí jen v rámci pole; návrhy B se nikdy nepoužijí bez potvrzení.
- Testy ve společném `testdata/hledani-pripady.json` (Go i JS): `vlasy:blond` najde „Blonde“, vypnutá skupina nenajde,
  negace `-vlasy:blond` vyloučí i „plavá“. **Kritérium:** všechny případy projdou v obou implementacích stejně.

---

## Společné části

### Uložení a vazby (bez změny schématu)

| Klíč v `nastaveni` | Obsah | Velikost |
|---|---|---|
| `hledani_synonyma` | potvrzené a vypnuté skupiny, opravy štítků | < 10 kB |
| `hledani_historie` | 50 dotazů s četností a datem | < 5 kB |
| `hledani_uceni` | kliky dotaz → modelka, obliba profilů | < 100 kB |

- Vazby `GetNastaveniHledani() map[string]string` a `UlozitNastaveniHledani(klic, json string) bool`; Go přijme
  jen klíče `hledani_*` a JSON do 128 kB. V `backend.js` nový seznam volání **bez ohlášení změny dat**
  (zápis učení není změna sbírky); `backend.test.js` ho hlídá.
- Proč ne `localStorage`: ztratí se při obnovení zálohy a přesunu složky dat, nevidí ho Go (řazení `jako:`, testy).
  `localStorage` zůstává jen pro volby vzhledu jako dnes.
- Proč ne soubor vedle `okno.json`: šlo by, ale data patří ke sbírce (zálohují se s ní); `okno.json` je mimo
  databázi jen proto, že se čte před otevřením databáze.
- `TestZmrazeniAlfy` se nemění: úprav schématu zůstává 11, export verze 7.

### Výkon (rozpočet)

| Část | Kde | Rozpočet na 5 000 modelkách |
|---|---|---|
| Převod věty | JS | < 2 ms |
| Našeptávač (po stisku) | JS | < 30 ms |
| Sestavení slovníku a indexu po změně dat | JS | < 50 ms, jednou |
| Synonyma v hledání | Go + JS | ≤ 10 % k dnešnímu hledání |
| `jako:` | Go | ≤ 10 ms navíc |
| Řazení podle učení | JS | < 2 ms |

`vykon_test.go`: nová `naplnitSbirku(n)` s 5 000 modelkami a případy `jako:`, synonyma a celé hledání;
JS měření v `frontend/test/veta.test.js` s vygenerovanou sbírkou.

### Soukromí

Žádné síťové volání, žádný model ke stažení, žádná telemetrie. Naučené údaje jsou v databázi uživatele
(a v jejích zálohách), nejsou v exportu, jdou zobrazit a smazat v ⋯ → Hledání.

### Co nedělat

- **Hledání podle obsahu fotky** („na pláži“, „v červeném“): potřebuje velký obrazový model nebo cloud – nedělat
  (souhlasí s ROADMAP „Nápady k posouzení“ a „Nedělat“: rozpoznávání obličejů).
- Jazykový model (API i místní), embeddingy z korpusu, learning-to-rank.
- Automatické přepisování dat podle synonym (to je Údržba, s potvrzením).
- Učení, které výsledky skrývá nebo mění výchozí řazení bez volby uživatele.
- Druhý, třetí hledací engine: vše se převádí na dnešní dotaz.

---

## Cesta vývoje

Každá verze je malá (1–3 dny, 2–4 kroky), projde všemi testy a jde vyzkoušet sama. Pořadí podle závislostí
a hodnoty: synonyma jsou základ slovníku pro větu i našeptávač; věta je hlavní přínos; učení potřebuje
historii z našeptávače.

| Verze | Obsah | Prac. | Závisí na |
|---|---|---|---|
| 1.9.0 | Synonyma I: měření `GetModelky` na 5 000 modelkách; společné `testdata/hledani-pripady.json` (Go i JS); výchozí slovník synonym (`//go:embed`) a rozšíření variant v `odpovidaHledani` i `vyhovujeHledani`; štítek „(+N)“ | M | – |
| 1.9.1 | Našeptávač II: index hodnot všech polí, hodnoty bez klíče, počty z výsledků, roky z dat; vazby `GetNastaveniHledani`/`UlozitNastaveniHledani` bez ohlášení změny dat; historie hledání | M | 1.9.0 |
| 1.9.2 | Česká věta I: `lib/veta.js` (normalizace, stemming, slovník ukazatelů, čísla a rozsahy, negace, pravidlo jména); řádek „Rozumím:“ se štítky, Tab / Ctrl+Enter; 30 testovacích vět | M–L | 1.9.0 |
| 1.9.3 | Česká věta II: slovník ze sbírky (národnosti, fotografové se skloňováním, tagy, kategorie z `KATEGORIE`), obyvatelé, dvojznačnosti s volbou významu, „Vždy takto“; sada 50 vět; volitelně `pole:*` | M | 1.9.2 |
| 1.9.4 | Jako X: `podobnost.go` (sdílené statistiky a podobnost jmen s kontrolou), `jako:` v Go, řazení Podobnost s důvody, „Podobné →“ v profilu | M | – (sladit s `kontrola_uceni.go`) |
| 1.9.5 | Učení z otevíraných: záznam kliků, skóre v našeptávači, řazení Relevance, značka ↑, Zapomenout | M | 1.9.1 |
| 1.9.6 | Synonyma II: návrhy ze sbírky a z oprav, okno ⋯ → Hledání → Synonyma, statistiky na společném slovníku | S–M | 1.9.0, 1.9.3 |

**Hotovo, když (celá 1.9):**

- z 50 testovacích vět je ≥ 45 převedeno přesně, žádné jméno ze sady 20 jmen se nepřevede, žádné slovo se neztratí;
- každý převod, rozšíření synonymem i podobnost jsou vidět ve štítcích nebo důvodech a jdou jedním klikem vrátit;
- našeptávač nabízí hodnoty všech textových polí s počty a vlastní historii; odezva < 30 ms na 5 000 modelkách;
- po třech otevřeních je modelka u stejného dotazu v našeptávači první; „Zapomenout“ vrátí původní pořadí;
- `jako:"jméno"` vrátí podobné modelky s důvody a přidá ≤ 10 ms; kontrola duplicit používá stejný kód;
- všechny případy v `testdata/hledani-pripady.json` dávají v Go i JS stejný výsledek;
- schéma zůstává na úpravě č. 11 a export na verzi 7; program nic neposílá po síti;
- uživatel vyzkoušel celé téma na skutečné sbírce.

### Text pro ROADMAP (náhrada oddílu „### 1.9“)

```markdown
### 1.9 – Chytré hledání (strojové učení nad sbírkou)

**Cíl:** hledání rozumí běžné češtině a učí se ze sbírky a z používání – vše v programu, bez internetu
a bez velkých modelů. Každá chytrá funkce se převádí na dnešní cílené hledání (`pole:hodnota`), které je vidět
a jde upravit. **Bez změny schématu i exportu** – naučené údaje jsou v tabulce `nastaveni`. Každý krok vyjde
jako samostatná verze (1.9.0–1.9.6). Rozbor možností: [NAVRH-HLEDANI.md](docs/NAVRH-HLEDANI.md).

**Rozhodnutí:** pravidla a slovník z hodnot sbírky místo klasifikátoru nebo jazykového modelu (průhledné,
testovatelné, offline); podobnost modelek váženou vzdáleností nad údaji, sdílenou s kontrolou v Údržbě.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Synonyma I | Výchozí slovník („blond“ = „blonde“ = „plavá“, národnosti cs/en) v hledání Go i JS, štítek „(+N)“; společné testovací případy hledání pro Go i JS; měření hledání na 5 000 modelkách | M |
| 2 | Našeptávač II | Hodnoty všech polí ze sbírky s počty (i bez klíče, i „z výsledků“), roky z dat, historie vlastních hledání | M |
| 3 | Česká věta I | „blondýnky z 90. let bez tetování“ → `vlasy:blond rok:1990..1999 tetovani:ne`; lehký stemming, čísla a rozsahy („vyšší než 175“, „narozené po 1980“), negace; řádek „Rozumím:“ se štítky, Tab převede, Ctrl+Enter hledá doslova | M–L |
| 4 | Česká věta II | Národnosti a fotografové ze sbírky se skloňováním, volba významu u dvojznačných slov, „Vždy takto“; 50 testovacích vět | M |
| 5 | „Jako X“ | `jako:"jméno"` najde podobné modelky (postava, vlasy, období, kategorie) s důvody, řazení Podobnost, „Podobné →“ v profilu; kód podobnosti sdílený s kontrolou duplicit | M |
| 6 | Učení z otevíraných výsledků | Co po hledání otevíráš, jde příště výš (našeptávač, řazení Relevance); jen v počítači, jde zapomenout | M |
| 7 | Synonyma II | Návrhy synonym ze sbírky a z oprav k potvrzení v ⋯ → Hledání → Synonyma | S–M |

**Nedělá se:** hledání podle obsahu fotky, jazykový model (API ani místní), přepisování dat podle synonym.

**Hotovo, když:** z 50 testovacích vět je ≥ 45 převedeno správně a žádné jméno se nepřevede; každý převod je
vidět a jde vrátit; našeptávač odpoví do 30 ms a `jako:` přidá nejvýš 10 ms na 5 000 modelkách; po třech
otevřeních je modelka u stejného dotazu první; schéma zůstává na úpravě č. 11 a export na verzi 7.
```
