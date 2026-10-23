# Plán: 1.5 Kvalita dat, 1.6 Kontrola 2.0, 1.7 Přehledy

Stav k 23. 10. 2026 (verze 0.99.3, schéma úprava č. 11, export verze 7). Rozpracování tří verzí řady 1.x
„Pohodlí a kvalita dat“ do dílčích kroků (každý krok = PATCH) a návrh rozšíření. Nic z toho není rozhodnuté;
text k vložení do `ROADMAP.md` je na konci. Čísla verzí jsou podle revize 23. 10. 2026 (sloupec „Dřív“:
1.5 = dřív 1.6, 1.6 = dřív 1.16 v [NAVRH-KONTROLA2.md](NAVRH-KONTROLA2.md), 1.7 = dřív 1.4).

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export.

## Pro koho a proč

Uživatel má kolem 400 modelek, přidává desítky denně chronologicky (teď rok 1977), hodnotí **každou** modelku
1–5 srdíčky a fotky jen ty, které se mu líbí. Z toho plyne:

- **Chyba se má najít hned při zadání**, ne o týden později v Údržbě – za den přibude 20–40 modelek.
- **Nehodnocená fotka není úkol** (do Údržby nepatří); nehodnocená modelka ano.
- **Sbírka roste po letech:** nové modelky jsou vždy na okraji sbírky (nejnovější rok). Kontrola podle období
  (1.6) proto musí počítat s jednostranným oknem; přehledy mají umět „rozpracovaný ročník“.
- **Ověření na skutečné sbírce** proběhne na letech 1953–1977; kritéria typu „pas 70 cm v roce 2008“ jde ověřit
  jen na umělé sbírce v testech.

## Výchozí stav v kódu (co už je)

| Kde | Co je hotové | Co z toho plyne |
|---|---|---|
| `kontrola.go` `kontrolovatSbirku` | Pravidla `ok-…` (jména, data, postava, Playmate roku, centerfold čísla, album s jednou fotkou, dvojice fotek) | Nová pravidla jdou přidat stejným `pridat`; nové klíče `ok-…` jen spolu s novou verzí exportu |
| `kontrola_uceni.go` | Naučené rozsahy, Mahalanobis kombinací, podobná jména (Jaro–Winkler, `podobnostModelek`) | `podobnostModelek` jde použít i při psaní jména (1.5.3) |
| `nastaveni.go` `GetPrehled` | Chybějící titulní fotka, narození, centerfold, hodnocení, text a vydání alba, cover a centerfold čísla, nálezy kontroly | Nové seznamy (alba bez fotografa, obálky bez modelky) se přidají sem |
| `frontend/src/app/prehled.js` | Údržba jako jedna fronta s filtry, váha = počet úkolů, ⋯ „Netýká se / V pořádku“ | Nové filtry a druhy řádků; řazení podle jistoty (1.6.1) |
| `prehled-uvod.js` | Karta „Naposledy přidané“: 6 modelek podle `modelky.pridano` | 1.7.0 ji rozšíří na dny, alba a fotky (`fotky.pridano` už se ukládá) |
| `alba.go` `SloucitModelky`, `PrejmenovatFotografa`, `PrejmenovatTag` | Sloučení modelek (s doplněním údajů a zálohou), přejmenování v celé sbírce | Sloučení a sjednocení zápisů se jen napojí na Údržbu |
| `app.go` `GetAlbaFotografa`, `PrejmenovatFotografa` | Porovnávají **celé pole** fotografa (bez diakritiky a velikosti písmen) | **Nedostatek:** album s „Pompeo Posar, Arny Freytag“ není na stránce ani jednoho; `GetStatistiky` přitom jména čárkou dělí. Opraví 1.5.0 |
| `app.go` `GetFotografove` | `DISTINCT TRIM(fotograf)` | Našeptávač nabízí „Arny Freytag“ i „arny freytag“ zvlášť |
| `vyrez.js` `neniDuplicitni` | Při uložení nové modelky jen **přesná** shoda jména nebo pseudonymu | Podobné jméno (překlep) se pozná až v Údržbě; 1.5.3 to přesune do psaní |
| `vydani.js` `vykreslitAlbaFotografa`, ročník | Obrázek alba = `a.fotky[0]` (první podle srdíček nebo ručního pořadí) | Titulní fotka alba (1.5.1) nahradí `fotky[0]` |
| `statistiky.go` / `statistiky.js` | Grafy v čase, rozložení, nejčastější fotografové (8) | Rekordy (1.7.2) se počítají v JS ze stejných dat |
| `app.go` `migrace`, `TestZmrazeniAlfy` | 11 úprav; novější schéma → program běží jen pro čtení; export > 7 se odmítne | Pravidlo pro 1.5.1 už kód splňuje, mění se jen test zmrazení |

---

## 1.5 – Kvalita dat

**Cíl:** chyby a nejednotné zápisy se najdou v Údržbě i přímo při zadávání; alba mají vlastní titulní fotku.
Jediná změna schématu celé trojice verzí: **úprava č. 12, export verze 8** (krok 1.5.1).

| Verze | Krok | Prac. | [schéma] |
|---|---|---|---|
| 1.5.0 | Sjednocení zápisů: fotografové a hodnoty polí | M | ne |
| 1.5.1 | Schéma 12 / export 8: titulní fotka alba, nové klíče „netýká se“ | S–M | **ano** |
| 1.5.2 | Nové úkoly v Údržbě: playmate bez data narození, obálka bez modelky, album bez fotografa | M | ne (používá 1.5.1) |
| 1.5.3 | Kontrola při zadávání: podobné jméno při psaní, nálezy hned po uložení, sloučení z Údržby | M | ne |

### 1.5.0 – Sjednocení zápisů

**Co se mění:**
- Nový `zapisy.go`: `GetRuzneZapisy() []SkupinaZapisu` – pro pole fotograf (dělené čárkou), národnost, místo
  narození, barva vlasů, barva očí, etnicita a tagy najde skupiny zápisů, které jsou nejspíš totéž:
  stejné po `zjednodusit` (jen velikost písmen nebo diakritika), Jaro–Winkler ≥ 0,92 (`jaroWinkler`
  z `kontrola_uceni.go`), stejné příjmení a iniciála („A. Freytag“), prohozené pořadí slov. Návrh = nejčastější zápis.
- `SjednotitHodnotu(pole string, z []string, na string) int` se zálohou `pred-sjednocenim`; pro fotografa
  i tagy pracuje **po jménech v seznamu** (oprava `PrejmenovatFotografa`, který dnes porovnává celé pole).
- Oprava `GetAlbaFotografa`: album patří každému fotografovi ze seznamu v poli.
- „Různí lidé“ (např. Ken Marcus / Ken Markus): dvojice v `nastaveni` pod klíčem `zapisy_ruzne` (JSON);
  bez změny schématu, do exportu nejde (jen pohodlí, data se tím nemění).
- Údržba: filtr „Zápisy“, řádek na skupinu.

```
Údržba · [Vše 31] [Údaje 14] [Kontrola 9] [Zápisy 3]
┌──────────────────────────────────────────────────────────────────────────┐
│ Fotograf   Arny Freytag (41) · Arnie Freytag (2) · A. Freytag (1)        │
│            [Sjednotit na „Arny Freytag“]  [⋯ Jiný zápis… · Různí lidé]   │
│ Národnost  USA (212) · usa (3) · Spojené státy (1)   [Sjednotit na „USA“]│
└──────────────────────────────────────────────────────────────────────────┘
```

**Testy:** tabulkový test skupin (diakritika, překlep, iniciála, pořadí slov, „Různí lidé“ se nehlásí);
sjednocení v poli „Posar, Arnie Freytag“ změní jen druhé jméno; album se dvěma fotografy je na stránce obou;
determinismus pořadí skupin; databáze jen pro čtení nic nezmění.

**Rizika:** zápis „Freytag, Arny“ se rozdělí čárkou na dvě jména (ukáže se jako dva fotografové – nápověda
u pole); planá podobnost u krátkých jmen (práh jen od 6 znaků, jinak jen shoda po `zjednodusit`).

**Hotovo, když:** varianty jednoho fotografa i národnosti se ukážou jako jedna skupina a jdou sjednotit jedním
klikem se zálohou; našeptávač fotografů pak nabízí jen jeden zápis; album se dvěma fotografy je na obou stránkách.

**Ověří uživatel:** ve skutečné sbírce projde filtr „Zápisy“, sjednotí fotografy a zkontroluje stránku
fotografa (počet alb odpovídá Statistikám → Fotografové).

### 1.5.1 – Schéma 12, export 8 **[schéma]**

**Co se mění:**
- `migraceTitulniAlba` (úprava č. 12, na konec `migrace`): `ALTER TABLE alba ADD COLUMN titulni TEXT`
  (ID souboru na Disku, ne `fotky.id` – to se při importu mění) a `ALTER TABLE vydani ADD COLUMN netyka_se TEXT`.
- Výčty v `schema.go`: `klicNetykaSeAlba` + `fotograf`; nový `klicNetykaSeVydani` = `obalka`.
- `SetTitulniFotkaAlba(albumID, fotoID int) bool` (0 = automaticky); `Fotografie` dostane `titulniAlba`
  přes `vyberPopisu`; `sestavitAlba` (`lib/alba.js`) vybere titulní fotku, jinak `fotky[0]` jako dnes.
  Fotka odebraná nebo přesunutá z alba = návrat k automatické volbě (žádný visící odkaz).
- Nabídka fotky (`akce-fotky.js`): „Nastavit jako titulní fotku alba“ / „Zrušit titulní fotku alba“.
  Použití: karty na stránce fotografa, ročník („Celý ročník“), později Naposledy přidané (1.7.0).
- Export 8 (`export.go`, `verzeExportu = 8`): u alba `titulni_fotka: <id>`, u čísla `netyka_se: obalka`,
  u alba nová hodnota `netyka_se: fotograf`. Import verze 1–7 beze změny; `titulni_fotka`, která v albu
  není, se přeskočí s hláškou. `EXPORT.md` (nadpis, tabulky, řádek historie) a `vzor-exportu.yaml`.
- Volitelně (rozhodnout teď, později to znamená další úpravu schématu): `modelky.upraveno` pro
  „Naposledy upravené“ – viz rozšíření R6.

```
Fotka ⋯  Otočit · Přesunout do alba… · ★ Nastavit jako titulní fotku alba · Odebrat
Fotograf · Arny Freytag      [karta alba = vybraná titulní fotka, páska 1977-03]
```

**Testy:** `TestZmrazeniAlfy` → `TestVerzeDat` (12 a 8); `TestPrechodZeStarychVerzi` dostane databázi
a export z 1.4.x do `testdata/stare-verze`; kruh export → import zachová titulní fotku i nové klíče; databáze se
`user_version` 13 se neupraví a program běží jen pro čtení (test už je); export 9 se odmítne.

**Rizika:** jediné místo, kde se mění data – záloha před migrací už je; starší program (1.4) databázi 12
otevře jen pro čtení, uživatel o tom musí vědět před aktualizací (věta v „Co je nového“).
Konflikt čísel: rezerva „Mám PDF“ v ROADMAP počítá s úpravou 12 a exportem 8 – dostane další volné číslo.

**Hotovo, když:** titulní fotka alba jde nastavit a zrušit, ukazuje se na stránce fotografa a ročníku; přechod
z 11 na 12 projde na kopiích všech starých verzí; export 8 → import vrátí totéž; 1.4 otevře novou databázi jen
pro čtení a export 8 odmítne srozumitelnou hláškou.

**Ověří uživatel:** před aktualizací export YAML; po ní nastaví titulní fotku u pár alb jednoho fotografa,
export → import do prázdného účtu ukáže stejné karty.

### 1.5.2 – Nové úkoly v Údržbě

**Co se mění:**
- `GetPrehled`: `AlbaBezFotografa` (centerfold a pictorial bez fotografa, ne „netýká se: fotograf“)
  a `ObalkyBezModelky` (číslo s coverem bez `modelka_obalky` i `na_obalce`, ne „netýká se: obalka“).
- `prehled.js`: filtry „Fotograf alb“ a „Obálky“; chip „2 alba bez fotografa“ otevře úpravu alba s kurzorem
  v poli Fotograf; chip „kdo je na obálce“ otevře „Upravit číslo…“; ⋯ „Netýká se“ uloží nové klíče.
- **Playmate bez data narození:** jen v rozhraní (průnik `bezNarozeni` a modelek s centerfoldem), vlastní filtr
  a váha +2 ve frontě – věk při centerfoldu je hlavní údaj Statistik a kontroly věku.
- Souhrn úvodu: řádky „Alba s fotografem“, „Obálky s modelkou“.

```
[Vše 38] [Playmate bez narození 6] [Fotograf alb 12] [Obálky 4] [Zápisy 3] [Kontrola 9]
│ (o) 1977-04 · číslo      [kdo je na obálce]                    [Doplnit] [⋯] │
│ (o) Lisa Sohm            [datum narození] [1 album bez fotografa] [Doplnit] [⋯] │
```

**Testy:** Go – seznamy z `GetPrehled` respektují „netýká se“ i sdílený centerfold; JS – počty filtrů
a váha (test modulu Údržby, pokud existuje, jinak ručně podle scénáře).

**Rizika:** první spuštění ukáže stovky alb bez fotografa (staré pictorialy) – filtr není ve „Vše“ výš než
ostatní úkoly (váha 1) a souhrn ukáže pokrok.

**Hotovo, když:** tři nové druhy úkolů jdou doplnit i označit „Netýká se“ a přežijí export → import.

**Ověří uživatel:** ročník 1977 – všechna čísla s coverem mají modelku z obálky nebo „Netýká se“.

### 1.5.3 – Kontrola při zadávání

**Co se mění:**
- `PodobneModelky(jmeno, narozeni string) []PodobnaModelka` (Go, `kontrola_uceni.go`): `pripravitJmeno`
  + `podobnostModelek` s nižším prahem pro nápovědu (0,88), nejvýš 3 výsledky s titulní fotkou a prvním vydáním.
- Rychlé přidání a formulář modelky: při psaní jména (prodleva 250 ms) řádek pod polem; `neniDuplicitni`
  zůstává jako pojistka při uložení.
- `ZkontrolovatModelku(id int) []PodezrelyUdaj` = `kontrolovatSbirku` omezená na jednu modelku (učení
  z celé sbírky); po uložení oznámení s nálezy a tlačítkem Opravit (otevře pole).
- Fotograf a národnost: hodnota, která ve sbírce není, ale je podobná existující → „Myslel jsi „Arny Freytag“?“.
- ⋯ u nálezu `ok-podobne-jmeno` a `ok-jmeno`: „Sloučit…“ otevře stávající `sloucitModelku` s předvybranou modelkou.

```
Jméno  [Debra Jensen        ]
       Podobná modelka už je: Debra Jenson (1977-12, ♥♥♥)  [Otevřít]  [To je jiná]
──
Uloženo · 1 věc ke kontrole: výška 17 cm je mimo obvyklý rozsah 150–186 cm   [Opravit]
```

**Testy:** `PodobneModelky` – překlep, prohozené jméno, jiný rok narození vyloučí, 5 000 modelek < 20 ms;
`ZkontrolovatModelku` vrátí totéž co celá kontrola pro tutéž modelku.

**Rizika:** rušivé nápovědy při psaní (ukáže se až od 5 znaků, „To je jiná“ ji pro to jméno skryje do zavření
formuláře); kontrola po uložení nesmí zdržet další zadávání (asynchronně, oznámení se dá přeskočit).

**Hotovo, když:** překlep ve jméně existující modelky se ukáže během psaní; výška 17 cm se ohlásí hned po
uložení; nález podobného jména jde sloučit z Údržby dvěma kliky.

**Ověří uživatel:** den zadávání (20+ modelek) – kolik nálezů se ukázalo hned a kolik zbylo v Údržbě.

---

## 1.6 – Kontrola 2.0

Vychází z [NAVRH-KONTROLA2.md](NAVRH-KONTROLA2.md) (rozhodnutí tam doporučená se přebírají). Návrh má pět kroků;
aby verze zůstala ve 2–4 krocích, **1.6 má čtyři** a učení z rozhodnutí jde do pokračování **1.14 Kontrola 2.1**
(viz rozšíření). Pořadí je upravené podle uživatele: návrh opravy („17 → 170?“) dává při desítkách modelek
denně největší užitek, proto jde před učení; pamatování nálezů jde do 1.6, aby události (opraveno / v pořádku)
začaly přibývat co nejdřív – učení v 1.14 pak má z čeho počítat. **Bez změny schématu i exportu.**

| Verze | Krok (NAVRH) | Prac. | Závisí na |
|---|---|---|---|
| 1.6.0 | Měření na kopii sbírky (4e) a postava podle období (1) | M–L | – |
| 1.6.1 | Jistota a řazení (2), nová pravidla z 1.5 do jistoty (4f) | M | 1.6.0 (jde i bez) |
| 1.6.2 | Návrh opravy (4a) | M | 1.6.1 |
| 1.6.3 | Pamatování nálezů (3, body 1–5 a 8) – jen počítá, nic neladí | M | 1.6.1 |

### 1.6.0 – Měření a postava podle období

**Co se mění:** test `TestMereniSkutecneSbirky` jen s proměnnou `PLAYBOY_DB` (počty nálezů po pravidlech
a obdobích, nic nezapisuje); `naucitObdobi` v `kontrola_uceni.go` (okno ±5 až ±15 let, ≥ 40 hodnot, přitažení
w = n/(n+40), σ nejméně 0,7·σ sbírky); `modelPostavy.zSkore` s rokem modelky z `prvniVydani`; pojistka proti
záplavě (bod 7 návrhu); text nálezu „kolem roku 1962 (1957–1967) obvykle 50–66 cm“.

**Doplnění k návrhu – okraj sbírky:** uživatel přidává po letech, takže nejnovější rok má okno jen do
minulosti (1977: 1967–1977) a hodnoty se porovnávají se staršími. Okno na okraji se proto nerozšiřuje jen
dozadu: chybí-li budoucí roky, přitažení k celé sbírce dostane větší váhu (w = n/(n+80)) a pojistka (≥ 3σ od
sbírky) platí vždy. Test: umělá sbírka s trendem uříznutá v roce 1977 nehlásí víc nálezů u let 1975–1977 než
uprostřed.

**Hotovo, když:** v testu pas 70 cm v roce 1962 se hlásí, v roce 2008 ne; sbírka bez trendu má stejné nálezy;
na skutečné sbírce (1953–1977) nejvýš 1,5× víc nálezů a z 20 nových aspoň 14 skutečná chyba; 5 000 modelek ≤ 100 ms.

**Ověří uživatel:** spustí měření na kopii databáze (příkaz v `CHANGELOG.md`) a posoudí 20 nových nálezů.

### 1.6.1 – Jistota a řazení

**Co se mění:** `PodezrelyUdaj.Jistota`; vzácnost podle pravidla (t₅ u rozsahů, χ² u kombinací, skóre u jmen,
pevně 0,97 u tvrdých pravidel); slova a tečky; filtr Kontrola řazený podle jistoty, ve „Vše“ váha 1 + 4·jistota;
slabé nálezy (< 0,15) za odkazem „zobrazit i slabé (N)“; ⋯ „Proč je to podezřelé?“. Nová pravidla z 1.5
(zápisy, podobné jméno při psaní) dostanou výchozí přesnost π₀ a sílu ze skóre podobnosti.

**Hotovo, když:** ROC ≥ 0,9 na umělé sbírce se 40 překlepy; tvrdá pravidla nikdy mezi slabými; z prvních 20
nálezů skutečné sbírky aspoň 15 skutečná chyba.

**Ověří uživatel:** filtr Kontrola – prvních 20 řádků, kolik je skutečná chyba.

### 1.6.2 – Návrh opravy

**Co se mění:** `navrhOpravy(m Modelka, nalez) (pole string, hodnota string, ok bool)` v `kontrola_uceni.go`:
chybějící nebo přidaná číslice (17 → 170, 1700 → 170), prohozené číslice (107 → 170), desetinná čárka
(1,70 → 170), palce a libry (5'7", 115 lbs; převod jako `prevestVysku` ve `format.js`), obvody v palcích
(36-24-36 → 91-61-91), prohozený pas a boky, prohozený měsíc a den v datu. Kandidát musí padnout do rozsahu
období; jediný kandidát = návrh, víc kandidátů = žádný návrh. Návrh zvýší jistotu (×5 v šancích).
Rozhraní: chip s návrhem a tlačítko „Použít“ → `UpdateModelka`, oznámení s Vrátit (stará hodnota v paměti,
ne deník). Návrh se ukáže i v oznámení po uložení z 1.5.3.

```
│ (o) Jane Doe  [výška 17 cm → 170 cm?]  ●●● skoro jistě překlep   [Použít 170] [Opravit] [⋯] │
```

**Hotovo, když:** „výška 17 cm“ nabídne 170 cm a Vrátit; u 20 vzorových překlepů je návrh správný aspoň v 18
a u 20 skutečně neobvyklých hodnot se nenabídne žádný.

**Ověří uživatel:** záměrně zadá výšku 17 a pas 24 u zkušební modelky v kopii sbírky.

### 1.6.3 – Pamatování nálezů

**Co se mění:** otisk údajů nálezu (FNV-32 z hodnot, které pravidlo čte); snímek `kontrola_nalezy` a počty
`kontrola_uceni` v `nastaveni`; `porovnatNalezy` (čistá funkce) v `GetPrehled` pod zámkem a mimo
`jenProCteni`; import, obnovení zálohy a víc než 15 změn najednou se nepočítají; okno ⋯ → Kontrola údajů…
jen s čísly; zpřesnění „V pořádku“ u `ok-miry` (bod 8). **Doplnění:** nálezy ukázané v oznámení po uložení
(1.5.3) se zapíšou do snímku taky, jinak by se oprava hned po uložení nikdy nezapočítala.

**Hotovo, když:** tabulkový test porovnání (oprava, V pořádku, posun rozsahu, smazaná modelka, import, Znovu
kontrolovat) projde; databáze jen pro čtení se nezmění; oprava přes „Použít“ se započítá jako opraveno.

**Ověří uživatel:** po týdnu zadávání okno Kontrola údajů… ukazuje počty opravených a „V pořádku“ po pravidlech.

**Nedělá se v 1.6:** nové klíče `ok-…` (export 8 už vyšel s 1.5.1, další by chtěly export 9), deník změn,
knihovny strojového učení, skrývání tvrdých pravidel.

---

## 1.7 – Přehledy

**Cíl:** co přibylo, kdo fotil, co je výjimečné. Bez změny schématu i exportu (titulní fotku alba používá z 1.5.1).

| Verze | Krok | Prac. |
|---|---|---|
| 1.7.0 | Přibylo – dny, denní souhrn | S–M |
| 1.7.1 | Fotografové v Přehledu | S–M |
| 1.7.2 | Rekordy ve Statistikách (s ohledem na Kontrolu) | S–M |

### 1.7.0 – Přibylo

**Co se mění:** `GetPribylo(dni int) []DenPribylo` (nový soubor `pribylo.go`): po dnech z `modelky.pridano`
a `fotky.pridano` (album = den první fotky), modelky, alba s titulní fotkou, počty fotek; nová část Přehledu
„Přibylo“ v `CASTI` (`prehled.js`), karta na úvodu zůstane jako náhled s odkazem. Nahoře **denní souhrn**: co
dnes přibylo a co z toho ještě chybí (bez srdíček, bez data narození, ke kontrole) – klik otevře Údržbu jen
s dnešními modelkami (filtr `dnes` v `stav.udrzbaFiltr`).

```
Přibylo                                                     [7 dní ▾]
Dnes · 23 modelek · 31 alb · 742 fotek  — chybí: 2× srdíčka, 5× narození, 1× ke kontrole [Do Údržby →]
  [foto] Debra Jensen  1977-12 · Centerfold · 18 fotek
  [foto] Lisa Sohm     1977-04 · Pictorial „Swiss Miss“ · 24 fotek
Včera · 31 modelek · …
Starší než týden ▸
```

**Testy:** Go – seskupení podle dne, album přidané do existující modelky se ukáže ten den, fotky bez `pridano`
pod „bez data“; výkon 64 000 fotek < 50 ms (index na `fotky.pridano` je změna schématu – nejdřív změřit bez něj).

**Hotovo, když:** po dni práce ukáže „Přibylo“ všechno, co přibylo, a souhrn odpovídá Údržbě.

**Ověří uživatel:** večer po zadávání porovná souhrn s tím, co ten den přidal.

### 1.7.1 – Fotografové

**Co se mění:** `GetFotografoveSouhrn() []Fotograf` (jméno, alb, modelek, fotek, první a poslední vydání,
titulní fotka posledního alba; jména dělená čárkou a sjednocená po `zjednodusit` jako v `GetStatistiky`);
část Přehledu „Fotografové“ s hledáním a řazením (počet alb, abecedně, období); klik otevře `otevritFotografa`;
⋯ Přejmenovat (stávající `prejmenovatVeSbirce`) a „Sjednotit s…“ (z 1.5.0).

```
Fotografové · 38                                  [hledat…]  Řazení: [alb ▾]
[foto] Pompeo Posar     62 alb · 58 modelek · 1960–1977
[foto] Arny Freytag     41 alb · 39 modelek · 1975–1977
```

**Hotovo, když:** každý fotograf ze Statistik je v seznamu se stejným počtem alb a otevře svou stránku.

**Ověří uživatel:** počty u tří nejčastějších fotografů souhlasí se stránkou fotografa.

### 1.7.2 – Rekordy

**Co se mění:** karta „Rekordy“ ve Statistikách (`statistiky.js`, výpočet v JS ze `data.modelky`): nejmladší
a nejstarší v době centerfoldu, nejvyšší a nejnižší, nejlehčí a nejtěžší, nejužší pas, nejvíc centerfoldů,
obálek, alb a fotek, nejdelší doba mezi prvním a posledním vydáním, nejvýš hodnocené s nejvíc fotkami. Řídí se
výběrem Statistik (roky, edice) – „rekordy 70. let“ zadarmo. **Kontrola:** hodnota, která je nálezem kontroly
a není „V pořádku“, se do rekordů nepočítá a pod kartou je „3 hodnoty čekají na kontrolu →“ (rekord
„výška 17 cm“ by byl jen překlep). Shoda = „a 2 další“.

```
Rekordy · 1953–1977                                3 hodnoty čekají na kontrolu →
Nejmladší v době centerfoldu   18 let   Jane Doe (1972-05)
Nejvyšší                       183 cm   Mary Roe
Nejvíc obálek                  4        Ann Poe
```

**Hotovo, když:** každý řádek otevře profil; podezřelá hodnota se v rekordech neobjeví, po „V pořádku“ ano.

**Ověří uživatel:** rekordy celé sbírky a jednoho desetiletí odpovídají řazení v galerii.

---

## Rozšíření

Návrhy pro práci s desítkami modelek denně. U každého: užitek, pracnost, dopad na schéma a export, zařazení.

| # | Rozšíření | Užitek | Prac. | Schéma / export | Zařazení |
|---|---|---|---|---|---|
| R1 | Duplicita už při psaní nové modelky | chyba se nezaloží vůbec | S–M | ne | **v 1.5.3** |
| R2 | Rychlý návrh opravy „17 → 170?“ | oprava jedním klikem | M | ne | **v 1.6.2** |
| R3 | Kontrola hned po uložení modelky | nález v kontextu zadávání | S | ne | **v 1.5.3** |
| R4 | Sjednocení zápisů fotografů a hodnot polí | čisté Statistiky, hledání, stránky fotografů | M | ne | **v 1.5.0** |
| R5 | „Co dnes přibylo“ – denní souhrn | kontrola dne práce | S | ne | **v 1.7.0** |
| R6 | Lehká historie změn u modelky | – | M | ano (sloupec nebo tabulka) | **konflikt s Nedělat** – viz níže |
| R7 | Úplnost po desetiletích s cíli | vidět, kde data řídnou | S–M | ne | **1.12 (návrh)** |
| R8 | Filtr Údržby podle let a „rozpracovaný ročník“ | práce rok po roku | S–M | ne | **1.12 (návrh)** |
| R9 | Hromadná úprava údaje u výběru modelek | 20 modelek „USA“ najednou | M–L | ne | **1.13 (návrh)** |
| R10 | Sloučení dvou modelek s porovnáním údajů | rozhodnutí po polích místo „cílová vyhrává“ | M | ne | **1.13 (návrh)** |
| R11 | Učení Kontroly z rozhodnutí, jména podle období | méně planých poplachů časem | M | ne | **1.14 (návrh)** – pokračování 1.6 |
| R12 | Rekordy jako kontrola (podezřelé mimo rekordy) | rekordy nelžou | S | ne | **v 1.7.2** |
| R13 | Sloučení modelek přímo z nálezu Kontroly | dva kliky | S | ne | **v 1.5.3** |

**R6 – historie změn: konflikt.** ROADMAP, oddíl Nedělat: „Obecné Zpět pro všechny úpravy (deník změn) –
denní zálohy a Vrátit u fotek stačí“; NAVRH-KONTROLA2 deník také odmítá. Doporučení: **nedělat**. Co potřebu
pokryje bez deníku: posledních 100 událostí Kontroly (1.6.3: „22. 11. opraveno – výška 17 → 170“), Vrátit
u každé hromadné akce v oznámení, denní zálohy. Pokud by uživatel chtěl aspoň „Naposledy upravené“, stačí
sloupec `modelky.upraveno` – pak ho přidat **do úpravy č. 12 v 1.5.1** (později by to byla další úprava
schématu); do exportu nejde, starší program ho ignoruje. Rozhodne uživatel před 1.5.1.

### 1.12 (návrh) – Úplnost a ročníky

**Cíl:** práce po letech: vidět, které roky a údaje zaostávají, a dodělat rozpracovaný ročník. Bez změny
schématu i exportu. **Pozice:** hned po 1.7 (navazuje na Přehled a Údržbu). Pracnost celkem ~1,5 dne.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Úplnost po desetiletích | Tabulka desetiletí × skupiny údajů (narození, postava, vzhled, fotograf alb, titulní fotka), % vyplněno bez „netýká se“; cíl v ⋯ (výchozí 90 %, v `nastaveni`); buňka pod cílem zčervená a otevře Údržbu s filtrem; počítá se v rozhraní z dat Přehledu | S–M |
| 2 | Filtr Údržby podle let | „Roky: 1977 ▾“ / rozsah nad frontou podle prvního vydání modelky a vydání čísla; pamatuje se v `localStorage` | S |
| 3 | Rozpracovaný ročník | Karta na úvodu: poslední rok, ke kterému za 7 dní něco přibylo – centerfoldy 11/12, covery 12/12, modelky s úplnými údaji 28/31, bez srdíček 0, ke kontrole 2; klik otevře ročník nebo Údržbu s filtrem roku | S–M |

**Hotovo, když:** úplnost 70. let odpovídá Údržbě s filtrem 1970–1979; karta ukáže ročník 1977 a každé číslo
na ní vede na úkoly toho roku.

### 1.13 (návrh) – Hromadné úpravy a sloučení

**Cíl:** jeden údaj u mnoha modelek najednou a sloučení duplicit s rozhodnutím po polích. Bez změny schématu
i exportu. **Pozice:** po 1.12, před Editorem (1.8). Pracnost ~2 dny.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Výběr modelek | V galerii Ctrl/Shift + klik a Ctrl+A jako u fotek (`vyber.js`), lišta „N vybraných“; „Vybrat výsledky hledání“ | M |
| 2 | Upravit údaj… | Pole (národnost, vlasy, oči, ochlupení, tetování, piercing, kategorie a tagy přidat / odebrat), režim „jen prázdné“ (výchozí) / „přepsat“; náhled „změní se 12, přeskočí 3“; `UpravitModelkyHromadne` se zálohou `pred-hromadnou-upravou`, Vrátit v oznámení (staré hodnoty v paměti, ne deník) | M |
| 3 | Sloučení s porovnáním | Okno se dvěma sloupci údajů, u rozdílných volba, alba obou s počty; `SloucitModelky` dostane vybrané hodnoty; z profilu i z nálezu Kontroly | M |

**Hotovo, když:** 20 modelek dostane národnost jedním krokem a Vrátit je vrátí; sloučení s porovnáním
zachová zvolené hodnoty a projde existujícími testy sloučení. **Nedělat:** deník změn (Vrátit jen pro
poslední akci v oznámení, stejně jako u fotek).

### 1.14 (návrh) – Kontrola 2.1: učení z rozhodnutí

**Cíl:** zbytek NAVRH-KONTROLA2 (krok 4 a volitelné 4b, 4d). Bez změny schématu i exportu. **Pozice:** po 1.9
nebo později – až 1.6.3 nasbírá aspoň 10 událostí u tří pravidel (ukáže okno Kontrola údajů…). Pracnost ~1 den.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Učení z rozhodnutí | Přesnost pravidla Beta(4·π₀ + opraveno, 4·(1−π₀) + v pořádku) jako šance v jistotě; ladění k (4,0–6,0), α kombinací (1e-4–1e-7), prahu jmen (0,93–0,98) po krocích; řádek „Kontrola se naučila: …“, Zapomenout naučené | M |
| 2 | Jména podle období | `podobnostModelek`: první vydání víc než 15 let od sebe bez data narození −0,03, stejné desetiletí +0,02 | S |
| 3 | Mezipaměť učení | Výsledek `naucitSe` do další změny dat (počítadlo zápisů) | S |

**Hotovo, když:** simulace po 30 rozhodnutích posune prahy správným směrem a nikdy za meze; „Zapomenout
naučené“ vrátí výchozí nálezy; kontrola 5 000 modelek do 120 ms.

### Navržené pořadí a čas

| Pořadí | Verze | Kroky | Odhad |
|---|---|---|---|
| 1 | 1.5 Kvalita dat **[schéma]** | 4 | ~2 dny |
| 2 | 1.6 Kontrola 2.0 | 4 | ~2,5 dne |
| 3 | 1.7 Přehledy | 3 | ~1,5 dne |
| 4 | 1.12 Úplnost a ročníky (návrh) | 3 | ~1,5 dne |
| 5 | 1.13 Hromadné úpravy a sloučení (návrh) | 3 | ~2 dny |
| … | 1.8–1.9 Editor | | |
| po 1.9 | 1.14 Kontrola 2.1 (návrh) | 3 | ~1 den |

## Soulad s Rozhodnuto a Nedělat

- **Deník změn (Nedělat):** R6 se nedělá; Vrátit jen v oznámení po jedné akci (1.6.2, 1.13) jako u fotek.
- **Schéma a export:** jediná změna v 1.5.1 (úprava č. 12, export 8) podle pravidla „nová úprava + nová verze
  exportu, starší program jen pro čtení a novější export odmítne“. **Konflikt čísel:** rezerva „Mám PDF“
  v ROADMAP uvádí úpravu 12 a export 8 a 2.7 Chytré výběry 13 a 9 – čísla se přidělují podle pořadí vydání,
  text rezervy a 2.7 je potřeba upravit na „další volná úprava schématu a verze exportu“.
- **Nové klíče `ok-…`:** NAVRH-KONTROLA2 je zakazuje kvůli exportu 7; v 1.5 se zavádějí jen klíče „netýká se“
  (`fotograf` u alba, `obalka` u čísla) a jen spolu s exportem 8. Klíče `ok-…` zůstávají beze změny.
- **Stahování údajů z webu (Nedělat):** nic z tohoto plánu nestahuje.
- **Chytré funkce jen navrhují:** návrh opravy, sjednocení zápisů i podobné jméno se nikdy nezapíšou samy.
- **Hodnocení fotek:** nehodnocená fotka se nikde nepočítá jako chybějící údaj.

---

## Text k vložení do ROADMAP.md

Řádky do tabulky verzí (nahradí 1.5–1.7, nové řádky za 1.11):

```markdown
| 1.5 | Kvalita dat – sjednocení zápisů, titulní fotka alba, nové úkoly v Údržbě, kontrola při zadávání **[schéma]** | – | 1.6 |
| 1.6 | Kontrola 2.0 – postava podle období, jistota a řazení, návrh opravy, pamatování nálezů | 1.5 | 1.16 (kroky 1–3, 4a) |
| 1.7 | Přehledy – Přibylo s denním souhrnem, fotografové, rekordy | 1.5 (titulní fotka alba) | 1.4 |
| 1.12 | Úplnost a ročníky – úplnost po desetiletích, filtr Údržby podle let, rozpracovaný ročník (návrh, po 1.7) | 1.7 | – |
| 1.13 | Hromadné úpravy a sloučení s porovnáním (návrh, po 1.12) | – | – |
| 1.14 | Kontrola 2.1 – učení z rozhodnutí, jména podle období (návrh, po 1.9) | 1.6 | 1.16 (krok 4, 4b, 4d) |
```

```markdown
### 1.5 – Kvalita dat **[schéma]**

**Cíl:** chyby a nejednotné zápisy se najdou v Údržbě i přímo při zadávání; alba mají vlastní titulní fotku.
Úprava schématu č. 12 a export verze 8 (krok 2); ostatní kroky schéma nemění. Každý krok vyjde jako
samostatná verze (1.5.0–1.5.3). Rozpracování: [PLAN-1X-DATA.md](docs/PLAN-1X-DATA.md).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Sjednocení zápisů | `GetRuzneZapisy`: fotograf (dělený čárkou), národnost, místo narození, vlasy, oči, etnicita, tagy – stejné bez diakritiky, Jaro–Winkler ≥ 0,92, iniciála, prohozené pořadí; filtr „Zápisy“ v Údržbě, „Sjednotit na …“ se zálohou, „Různí lidé“ v `nastaveni`; oprava `PrejmenovatFotografa` a `GetAlbaFotografa` pro víc fotografů v poli | M |
| 2 | Titulní fotka alba a nové klíče **[schéma]** | Úprava č. 12: `alba.titulni` (ID souboru), `vydani.netyka_se`; klíče `fotograf` (album) a `obalka` (číslo); nabídka fotky „Nastavit jako titulní fotku alba“, použití na stránce fotografa a ročníku; export 8 (`titulni_fotka`, `netyka_se` u čísla), `EXPORT.md`, test verze dat a přechodu ze starých verzí | S–M |
| 3 | Nové úkoly v Údržbě | Playmate bez data narození (vlastní filtr, vyšší váha), číslo s coverem bez modelky z obálky, centerfold a pictorial bez fotografa; „Netýká se“ s novými klíči; řádky v souhrnu úvodu | M |
| 4 | Kontrola při zadávání | `PodobneModelky` při psaní jména (práh 0,88, nejvýš 3 s fotkou), „Myslel jsi …?“ u fotografa a národnosti, `ZkontrolovatModelku` po uložení s oznámením a Opravit; „Sloučit…“ u nálezu podobného jména | M |

**Hotovo, když:** varianty fotografa jdou sjednotit jedním klikem a album se dvěma fotografy je na obou
stránkách; titulní fotka alba se ukazuje na stránce fotografa a ročníku; nové úkoly jdou doplnit i označit
„Netýká se“; překlep ve jméně existující modelky se ukáže při psaní a výška 17 cm hned po uložení; přechod
na úpravu č. 12 projde ze všech starých verzí, export 8 → import vrátí totéž, 1.4 otevře novou databázi jen pro
čtení a export 8 odmítne srozumitelnou hláškou.
```

```markdown
### 1.6 – Kontrola 2.0

**Cíl:** kontrola v Údržbě porovnává modelky se stejnou dobou, řadí nálezy podle jistoty chyby, navrhne opravu
překlepu a začne si pamatovat opravy i „V pořádku“. **Bez změny schématu i exportu** – snímek nálezů a počty
jsou v tabulce `nastaveni`. Každý krok vyjde jako samostatná verze (1.6.0–1.6.3); učení z rozhodnutí je
v 1.14. Rozbor možností: [NAVRH-KONTROLA2.md](docs/NAVRH-KONTROLA2.md), kroky: [PLAN-1X-DATA.md](docs/PLAN-1X-DATA.md).

**Rozhodnutí:** klouzavé okno ±5 let podle prvního vydání přitažené k celé sbírce, na okraji sbírky (nejnovější
roky) silněji (ne desetiletí ani regrese); jistota = šance pravidla × vzácnost hodnoty (ne naučený klasifikátor);
návrh opravy jen při jediném kandidátovi v rozsahu období; opravy se poznají ze snímku ukázaných nálezů
v `nastaveni` (ne deník změn).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Postava podle období | Měření na kopii sbírky (`PLAYBOY_DB`); medián a σ po rocích (okno ±5 až ±15 let, ≥ 40 hodnot), přitažení w = n/(n+40), na okraji sbírky n/(n+80); z-skóre kombinací vůči období s korelací z celé sbírky; text „kolem roku 1962 obvykle …“ | M–L |
| 2 | Jistota a řazení | `Jistota` z vzácnosti hodnoty (t-rozdělení, χ², podobnost jmen) a přesnosti pravidla, i u pravidel z 1.5; „skoro jistě překlep“ / „možná chyba“; Kontrola řazená podle jistoty; slabé nálezy za odkazem; „Proč je to podezřelé?“ v ⋯ | M |
| 3 | Návrh opravy | Vzory: chybějící, přidaná a prohozená číslice, desetinná čárka, palce, libry, obvody v palcích, prohozený pas a boky, den a měsíc; kandidát v rozsahu období; „Použít 170“ s Vrátit, i v oznámení po uložení | M |
| 4 | Pamatování nálezů | Otisk údajů nálezu, snímek v `nastaveni`, porovnání v `GetPrehled`: zmizelý nález se změněným údajem = opraveno, „V pořádku“ = planý poplach; import, obnovení a hromadné změny se nepočítají; nálezy z oznámení po uložení se zapíší taky; okno ⋯ → Kontrola údajů… s počty | M |

**Nedělá se:** nové klíče `ok-…`, deník změn, knihovny strojového učení, skrývání tvrdých pravidel.

**Hotovo, když:** v testu se pas 70 cm v roce 1962 hlásí a v roce 2008 ne a sbírka uříznutá v roce 1977 nemá
na okraji víc nálezů; z prvních 20 nálezů skutečné sbírky je aspoň 15 skutečná chyba; „výška 17 cm“ nabídne
170 cm a u 20 vzorových překlepů je návrh správný aspoň v 18; oprava se započítá jako „opraveno“ a import ne;
kontrola 5 000 modelek do 120 ms; schéma ani export se nemění.
```

```markdown
### 1.7 – Přehledy

**Cíl:** rychlá orientace ve sbírce – co přibylo, kdo fotil, co je výjimečné. Bez změny schématu i exportu.
Každý krok vyjde jako samostatná verze (1.7.0–1.7.2).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Přibylo | Nová část Přehledu: dny (dnes, včera, tento týden, starší), modelky, alba s titulní fotkou a počty fotek z `pridano`; nahoře denní souhrn „Dnes 23 modelek · chybí 2× srdíčka, 5× narození, 1× ke kontrole“ s odkazem do Údržby jen na dnešní modelky; karta na úvodu zůstává jako náhled | S–M |
| 2 | Fotografové | Nová část Přehledu: fotografové (jména dělená čárkou a sjednocená) s počtem alb a modelek, obdobím a titulní fotkou posledního alba; hledání, řazení, klik otevře stránku fotografa; ⋯ Přejmenovat, Sjednotit s… | S–M |
| 3 | Rekordy ve Statistikách | Karta „Rekordy“: věk v době centerfoldu, výška, váha, pas, nejvíc centerfoldů, obálek, alb a fotek, nejdelší působení; podle výběru Statistik; hodnota, která čeká na kontrolu, se nepočítá („3 hodnoty čekají na kontrolu →“); každý řádek otevře profil | S–M |

**Hotovo, když:** po dni práce ukáže „Přibylo“ všechno, co přibylo, a souhrn odpovídá Údržbě; každý fotograf
ze Statistik je v seznamu se stejným počtem alb; každý rekord otevře profil a podezřelá hodnota mezi rekordy není.
```

```markdown
### 1.12 – Úplnost a ročníky (návrh)

**Cíl:** práce po letech – vidět, kde data zaostávají, a dodělat rozpracovaný ročník. Bez změny schématu
i exportu. Navrženo hned po 1.7.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Úplnost po desetiletích | Tabulka desetiletí × skupiny údajů (% vyplněno bez „netýká se“), cíl v ⋯ (výchozí 90 %, v `nastaveni`), buňka pod cílem otevře Údržbu s filtrem | S–M |
| 2 | Filtr Údržby podle let | Rok nebo rozsah podle prvního vydání modelky a vydání čísla | S |
| 3 | Rozpracovaný ročník | Karta na úvodu: poslední rok s přírůstkem za 7 dní – centerfoldy, covery, úplné údaje, srdíčka, ke kontrole; klik otevře ročník nebo Údržbu toho roku | S–M |

**Hotovo, když:** úplnost desetiletí odpovídá Údržbě s filtrem těch let; karta ukáže rozpracovaný ročník
a každé její číslo vede na úkoly toho roku.

### 1.13 – Hromadné úpravy a sloučení (návrh)

**Cíl:** jeden údaj u mnoha modelek najednou a sloučení duplicit s rozhodnutím po polích. Bez změny schématu
i exportu. Navrženo po 1.12.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Výběr modelek | Ctrl/Shift + klik a Ctrl+A v galerii jako u fotek, „Vybrat výsledky hledání“ | M |
| 2 | Upravit údaj… | Pole, „jen prázdné“ / „přepsat“, náhled počtu změn, záloha předem, Vrátit v oznámení (ne deník) | M |
| 3 | Sloučení s porovnáním | Dva sloupce údajů, volba u rozdílných, z profilu i z nálezu Kontroly | M |

**Hotovo, když:** 20 modelek dostane národnost jedním krokem a Vrátit je vrátí; sloučení zachová zvolené hodnoty.

### 1.14 – Kontrola 2.1: učení z rozhodnutí (návrh)

**Cíl:** Kontrola ladí prahy podle toho, co uživatel opravuje a co označí „V pořádku“. Bez změny schématu
i exportu. Navrženo po 1.9 – až 1.6 nasbírá aspoň 10 událostí u tří pravidel.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Učení z rozhodnutí | Přesnost pravidla (Beta) jako šance v jistotě, ladění k (4,0–6,0), α kombinací a prahu jmen (0,93–0,98) po krocích v mezích; „Kontrola se naučila: …“, Zapomenout naučené | M |
| 2 | Jména podle období | Podobnost jmen upravená podle vzdálenosti prvních vydání | S |
| 3 | Mezipaměť učení | Výsledek učení do další změny dat | S |

**Hotovo, když:** po 30 simulovaných rozhodnutích jsou prahy posunuté správným směrem a v mezích; „Zapomenout
naučené“ vrátí výchozí stav; kontrola 5 000 modelek do 120 ms.
```

Úprava rezervy v ROADMAP (konflikt čísel schématu):

```markdown
| 2 | „Mám PDF“ u americké edice **[schéma]** | Jen pokud se ukáže potřeba: stav čísla US „mám PDF“ (a cesta nebo odkaz na soubor), filtr a barva v mapě americké edice; další volná úprava schématu a verze exportu (úprava č. 12 a export 8 zabírá 1.5) | S–M |
```
