# Formát exportu (verze 14)

Export (nabídka ⋯ → Exportovat) uloží celou sbírku do jednoho souboru YAML, který jde číst a upravovat
v textovém editoru a znovu načíst importem. Tento popis platí pro **formát verze 14** (Pinup Katalog 0.02.008 a novější).
Soubory starších verzí (i z programu Playboy Database) jdou načíst dál: nemají časopisy a všechna jejich čísla jsou Playboy.

Od alfy (program 0.50.0) byl formát verze 7 **zmrazený**. Vědomé výjimky v betě jsou dvě: verze 8 přidala
online pictorialy (typ alba `Pictorial online` s datem nafocení) a verze 9 hodnocení modelky po polovinách
srdíčka (`hodnoceni: 3.5`). Od verze 9 je formát znovu zmrazený do verze 1.0.0. Soubory verzí 7, 8 i 9 půjdou
načíst i do vydané verze.

Vzorový soubor se všemi klíči a komentáři je [vzor-exportu.yaml](vzor-exportu.yaml); jde rovnou načíst importem.

## Pravidla importu

- Najednou jde vybrat víc souborů; načtou se jako jeden celek (jedna záloha, buď vše, nebo nic). Když je
  některý soubor chybný, hláška ho jmenuje a nezmění se nic.
- Přípony `.yaml`, `.yml` a `.md`. Z Markdownu se berou bloky ```yaml (každý zvlášť), jinak úvodní hlavička
  mezi řádky `---`, jinak celý soubor. Poznámky kolem bloků se ignorují.
- Soubor (nebo blok) může být celý export, seznam modelek, nebo jedna modelka s údaji přímo nahoře:

  ```yaml
  jmeno: "Jackie Rainbow"
  narodnost: "USA"
  vyska_cm: 165
  ```
- Modelka uvedená víckrát (třeba ve dvou souborech) se páruje podle jména a údaje se doplňují postupně.

- Import údaje **doplňuje a opravuje**. Prázdný nebo chybějící údaj ponechá ten stávající; údaj s hodnotou
  `-` se smaže (`narodnost: -`, `vyska_cm: -`, `tetovani: -` = neuvedeno, `titulni_fotka: -`, u alba
  `popis: -`, `fotograf: -`, `vydani: -`, `datum: -`, u čísla `poznamka: -`, `stav: -`, `na_obalce: -`). Alba, fotky
  ani modelky import nemaže.
- Překlep v klíči (`narodnot:`) se opraví na nejbližší známý klíč (`narodnost:`), pokud se liší nejvýš
  o dva znaky (u krátkých klíčů o jeden) a nejbližší klíč je jen jeden. Neznámý klíč se přeskočí.
  Obojí import vypíše s číslem řádku.
- Opakovaný import téhož souboru nic nezdvojí.
- Před importem se uloží záloha. Při jakékoli chybě zápisu se import vrátí celý a databáze zůstane, jak byla.
- Soubor s vyšší verzí formátu, než program zná, se odmítne celý (aktualizuj program). Starší verze 1–8
  se načtou; údaje, které v nich ještě nebyly, zůstanou nezměněné. Starší program (formát 8) soubor verze 9
  odmítne celý, i když poloviny srdíček neobsahuje.
- Údaje se kontrolují stejně jako při zadávání v programu. Chybné album nebo fotka se přeskočí a import
  vypíše, co a proč.

## Celek

```yaml
verze: 14
casopisy: [...]  # časopisy (Playboy, Penthouse, Hustler…), od verze 14
modelky: [...]   # modelky s jejich alby
covery: [...]    # obálky časopisu, nepatří k modelce
vydani: [...]    # stav a poznámky k jednotlivým číslům
vybery: [...]    # vlastní výběry fotek napříč sbírkou
```

## Modelka

| Klíč | Význam |
|---|---|
| `jmeno` | Jméno; podle něj se modelka při importu páruje (bez ohledu na velikost písmen a diakritiku) |
| `cislo` | Jen u jmen, která ve sbírce má víc modelek: číslo modelky v databázi, ze které export vznikl |
| `pridano` | Kdy byla modelka přidána (`RRRR-MM-DD HH:MM:SS`) |
| `dalsi_jmena`, `poznamka`, `odkazy`, `tagy` | Volný text (tagy oddělené čárkou) |
| `hodnoceni` | 0,5–5 srdíček po polovinách. Celé číslo se zapisuje bez desetinné části (`4`), polovina s tečkou (`3.5`); import přijme i desetinnou čárku (`3,5`). Jiná hodnota (`3.3`, `7`, text) je chyba souboru a import se neprovede; `0` nic nemění, `-` hodnocení smaže. Verze 1–8 znaly jen celá srdíčka |
| `narozeni_datum`, `umrti_datum` | Datum narození a úmrtí: `RRRR-MM-DD`, `RRRR-MM` nebo jen `RRRR`; úmrtí nesmí být před narozením, jiný tvar se ohlásí a stávající údaj zůstane |
| `narozeni_misto`, `narodnost`, `etnicita` | Základní údaje |
| `vyska_cm`, `vaha_kg`, `hrudnik_cm`, `pas_cm`, `boky_cm`, `miry`, `velikost_prsou`, `prsa_typ`, `vlasy`, `oci`, `ochlupeni` | Vzhled; `miry` se zapisují jen bez všech tří obvodů |
| `tetovani`, `piercing` | `ano` / `ne` |
| `prsa_typ` | `Přírodní` / `Silikonová` |
| `ochlupeni` | `Oholené` / `Zastřižené` / `Přírodní` |
| `role` | Kategorie oddělené čárkou: `Playmate měsíce`, `Playmate roku 1998`, `Cyber Girl týdne` / `měsíce` / `roku`, `Coed týdne` / `měsíce`, `Muse`, `Celebrita`, `Modelka obálky`, `Jen ve speciálu`, `Creator`, `Online` (modelka jen na internetu); jiný text zůstane jako vlastní kategorie. Import rozumí i anglickým názvům (Playmate of the Year, Cybergirl of the Month). Playmate měsíce a Modelku obálky program odvodí i sám z centerfoldu a obálky |
| `vystoupeni`, `pictorial_vydani` | Zařazení |
| `titulni_fotka`, `vyrez` (`zoom`, `poloha_x`, `poloha_y`) | Titulní fotka a její výřez |
| `profilova_fotka`, `profilovy_vyrez` (`zoom`, `poloha_x`, `poloha_y`) | Od verze 13: profilová fotka v záhlaví profilu (oddělená od titulní) a její výřez. Musí to být fotka z některého alba modelky (i sdíleného), jinak import ohlásí chybu; `-` profilovou fotku smaže. Výřez chybí, když je výchozí (`zoom: 1`, `poloha_x: 50`, `poloha_y: 22`) |
| `netyka_se` | Údaje, které se modelky netýkají (Přehled je nehlásí), oddělené čárkou: `titulni`, `zakladni`, `vzhled`, `zarazeni`, `centerfold`, `hodnoceni` |
| `alba` | Alba, ve kterých je modelka hlavní |

### Odkaz na modelku

Další modelky alba, modelka na obálce a modelka u fotky ve výběru se zapisují jménem. Má-li sbírka víc
modelek stejného jména, doplní se číslo v hranatých závorkách: `Anna [12]` odkazuje na modelku s `cislo: 12`
ve stejném souboru. Při importu do sbírky, kde jméno patří víc modelkám, rozhodne `cislo`; nejde-li modelku
určit jednoznačně, import to vypíše a odkaz přeskočí.

## Album

| Klíč | Význam |
|---|---|
| `nazev` | Název; u centerfoldu je to vydání `RRRR-MM` (české vydání `RRRR-MM-CZ`) |
| `typ` | `Pictorial`, `Pictorial online` (pictorial jen na webu – Cyber Girl, Coed, Muse…), `Cyber Girl týdne` / `Cyber Girl měsíce` (online album Cyber Girl of the Week / of the Month, týden nebo měsíc se počítá z `datum`; od 0.99.12 / 0.99.13) nebo `Centerfold` (covery mají vlastní oddíl) |
| `pridano` | Kdy přibyla první fotka alba |
| `vydani` | Jen u pictorialu: `RRRR-MM`, `RRRR` (jen ročník), s edicí `-CZ`; online album vydání nemá (import ho ohlásí a přeskočí) |
| `datum` | Jen u online alb (`Pictorial online`, `Cyber Girl týdne`, `Cyber Girl měsíce`): kdy bylo album nafoceno nebo zveřejněno, `RRRR-MM-DD`, `RRRR-MM` nebo `RRRR` (stejně jako datum narození). Je to jen údaj alba – nepřiřadí ho k vydání, do kalendáře ani k titulní fotce; jiný tvar nebo datum u jiného typu se ohlásí a přeskočí |
| `fotograf`, `popis` | Fotograf a text alba (víceřádkový text jako blok `|-`) |
| `spojit` | Stránky tvoří jeden spojený plakát |
| `rucni_poradi` | Fotky jsou v souboru v ručně určeném pořadí; jinak se album řadí podle srdíček |
| `dalsi_modelky` | Další modelky alba (odkazy na modelku); album je zapsané jen u hlavní modelky |
| `netyka_se` | `text`, `vydani` – co se alba netýká |
| `fotky` | Fotky alba; může být prázdné (`[]`), když albu zbyl jen text nebo další modelky |

Fotka: `id` (ID souboru na Google Disku nebo odkaz na něj), `hodnoceni` (1–5, jen celá srdíčka), `rotace` (90, 180, 270)
a `pridano`, jen když se liší od data přidání alba.

`tagy` (od verze 10): tagy fotky z pevného seznamu, např. `tagy: [postava, akt, prsa, studio]`. Záběr, Odhalení, Prostředí, Barevnost a Světlo mají nejvýš jednu hodnotu. Seznam: záběr `portret`, `poprsi`, `postava`, `detail`; odhalení `oblecena`, `pradlo`, `nahore_bez`, `akt`, `explicitni`; partie `prsa`, `zadecek`, `vagina`, `nohy`, `chodidla`; prostředí `studio`, `interier`, `loznice`, `koupelna`, `priroda`, `plaz`, `bazen`, `mesto`, `auto`; oblečení a doplňky `podpatky`, `puncochy`, `podvazky`, `bikiny`, `saty`, `kosile`, `kostym`, `latex`, `bunny`, `dziny`; póza a situace `stoji`, `sedi`, `lezi`, `zezadu`, `mokra`, `vic_modelek`; barevnost `cernobila`, `tonovana`; světlo `high_key`, `low_key`, `zlata_hodina`, `noc`; výraz `do_kamery`, `usmev`. Tagy `bazen`, `auto`, `bunny`, `dziny` a skupiny barevnost, světlo a výraz přibyly ve verzi 11. Neprázdný seznam při importu nahradí tagy fotky, neznámý tag se přeskočí, prázdný nebo chybějící nic nemění.

`pruvodce` (od verze 12): fotka prošla průvodcem hodnocení (Hodnocení › Hodnotit › Fotky) – číslo verze kroků, např. `pruvodce: 1`. Při importu hodnota větší než 0 fotku označí jako prošlou; chybějící nic nemění.

`vyrez` (od verze 15): ruční výřez náhledu fotky, např. `vyrez: {zoom: 1.5, poloha_x: 40, poloha_y: 20}`. `poloha_x` a `poloha_y` jsou bod zájmu v % šířky a výšky obrázku (náhled ho dá doprostřed rámu), `zoom` přiblížení 1–4. Platí pro soubor na Disku ve všech albech a má přednost před automatickým výřezem. Při importu se zapíše; chybějící nic nemění. (Výřez titulní fotky u modelky – `vyrez` modelky – je jiný údaj: poloha obrázku v kartě.)

`druh` (od verze 16): potvrzený druh fotky – `pozovaci`, `lesbicka`, `sex` nebo `muz` (na fotce je muž, ale nejde o sex: scéna, zákulisí). Platí pro soubor na Disku ve všech albech; nepotvrzená fotka pole nemá (odhad programu se neexportuje). Při importu se zapíše; chybějící nebo neznámý druh nic nemění.

## Časopis

```yaml
casopisy:
  - klic: PH              # dvě velká písmena; píše se na konec klíče čísla: 1985-09@PH
    nazev: Penthouse
    barva: '#7e57c2'      # nepovinné, #rrggbb
    edice: [US, UK]       # země vydání, první je výchozí (bez přípony): 1985-09@PH, 1986-03-UK@PH
    modelka_mesice: Pet of the Month   # nepovinné
    modelka_roku: Pet of the Year      # nepovinné
    poradi: 2             # nepovinné, pořadí v nabídkách
```

Import časopis podle klíče založí, nebo přepíše jeho údaje; prázdný údaj nechá původní. Edice se jen přidávají,
žádnou, kterou sbírka už má, import neubere. Playboy (`PB`) je výchozí a do klíče čísla se nepíše (`1985-09`);
jeho edice (`US`, `CZ`) určuje program. Číslo jiného časopisu musí mít časopis i edici v tabulce (výchozí
Playboy, Penthouse a Hustler v ní jsou vždy).

## Cover, vydání, výběr

```yaml
covery:
  - vydani: 2014-02       # RRRR-MM nebo RRRR-MM-CZ; jiný časopis s „@“: 1985-09@PH, 1986-03-UK@PH
    spojit: true          # nepovinné
    rucni_poradi: true    # nepovinné
    fotky: [{id: ...}]
vydani:
  - vydani: 1995-S01      # speciál: rok, S a pořadí v roce (s edicí 1995-S01-CZ)
    nazev: Playmate Review  # název má jen speciál
  - vydani: 2014-02
    stav: shanim          # mam (mám výtisk) | shanim | nezajima
    modelka_obalky: Anna  # odkaz na modelku ze sbírky; jméno, které ve sbírce není, se uloží jako na_obalce
    poznamka: ...
  - vydani: 1980-05
    na_obalce: Jméno Příjmení   # na obálce je někdo, kdo ve sbírce není (volný text)
  - vydani: 1996-01
    clanky:               # články čísla (obsah); článek se pozná podle názvu v čísle
      - strana: 27        # nepovinné
        rubrika: Playboy Interview   # volný text; obvyklé: Úvodník, Playboy Interview, 20 otázek, Článek, Povídka, Móda, Humor, Advisor
        nazev: Rozhovor s hercem roku
        autor: Lawrence Grobel
        modelka: Anna     # nepovinné; odkaz na modelku ze sbírky
        druh: prepis      # prepis | shrnuti (nepovinné)
        text: |           # odstavce oddělené prázdným řádkem; první je perex, „> “ citát
          Perex článku…

          PLAYBOY: Otázka?
        skeny: [id, ...]  # nepovinné; id souborů na Disku (skeny stran)
vybery:
  - nazev: Nejlepší
    fotky:
      - {modelka: Anna, album: Les, typ: Pictorial, id: ...}   # u coveru bez modelky
```

## Uzavřené výčty

U `prsa_typ` a `ochlupeni` nezáleží na velikosti písmen, uloží se v tvaru z nabídky formuláře; jiná
hodnota se ohlásí a stávající údaj zůstane. Hodnoty `typ` alba, edice Playboye (`US` bez přípony, `CZ`), `stav` čísla a klíče `netyka_se` jsou pevné. Další
verze programu je mohou jen rozšiřovat, existující hodnoty se nemění.

## Historie formátu

| Verze | Program | Změna |
|---|---|---|
| 16 | Pinup Katalog 0.02.061 | `druh` u fotky: potvrzený druh (pózovací, lesbická, sex, s mužem) podle souboru |
| 15 | Pinup Katalog 0.02.057 | `vyrez` u fotky: ruční výřez náhledu (bod zájmu a přiblížení) podle souboru |
| 14 | Pinup Katalog 0.02.008 | `casopisy` (klíč, název, barva, edice, tituly, pořadí) a čísla jiných časopisů s `@` (`1985-09@PH`, `1986-03-UK@PH`) u alb, coverů a vydání |
| 13 | 1.2.65 | `profilova_fotka` a `profilovy_vyrez` u modelky: profilová fotka oddělená od titulní |
| 12 | 1.2.5 | `pruvodce` u fotky: fotka prošla průvodcem hodnocení (číslo verze kroků) |
| 11 | 1.2.0 | Další tagy fotek: `bazen`, `auto`, `bunny`, `dziny`, barevnost, světlo a výraz (starší program by je tiše zahodil, proto nová verze) |
| 10 | 1.1.0 | `tagy` u fotky (pevný seznam pro tematické sezóny) |
| 9 | 0.99.26 | `hodnoceni` modelky po polovinách srdíčka (`3.5`, při importu i `3,5`); hodnocení fotek zůstává celé |
| 8 | 0.99.9 | Online pictorialy: typ alba `Pictorial online` (bez vydání) a jeho `datum` nafocení |
| 7 | 0.30.0 | Články čísla: `clanky` u vydání (strana, rubrika, název, autor, modelka, druh, text, skeny) |
| 6 | 0.18.0 | `umrti_datum` u modelky, data narození a úmrtí i neúplná (`RRRR`, `RRRR-MM`), `na_obalce` u čísla, `-` údaj smaže, oprava překlepů v klíčích |
| 5 | 0.13.0 | Speciály (`RRRR-Snn`) a jejich `nazev` u vydání, stav čísla `mam` |
| 4 | 0.10.0 | Kontrola verze, `cislo` a odkazy `Jméno [číslo]`, `netyka_se` u modelky i alba, `pridano` u fotky, `spojit` a `rucni_poradi` u coveru, alba bez fotek |
| 3 | 0.9.0 | Odkazy modelky, vydání (stav, obálka, poznámka), výběry |
| 2 | 0.6.0 | Další modelky alba |
| 1 | 0.3.0 | První podoba |
