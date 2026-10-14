# Formát exportu (verze 5)

Export (nabídka ⋯ → Exportovat) uloží celou sbírku do jednoho souboru YAML, který jde číst a upravovat
v textovém editoru a znovu načíst importem. Tento popis platí pro **formát verze 5** (program 0.13.0 a novější).

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

- Import údaje **doplňuje a opravuje, nic nemaže**. Prázdný nebo chybějící údaj ponechá ten stávající.
- Opakovaný import téhož souboru nic nezdvojí.
- Před importem se uloží záloha. Při jakékoli chybě zápisu se import vrátí celý a databáze zůstane, jak byla.
- Soubor s vyšší verzí formátu, než program zná, se odmítne celý (aktualizuj program). Starší verze 1–3
  se načtou; údaje, které v nich ještě nebyly, zůstanou nezměněné.
- Údaje se kontrolují stejně jako při zadávání v programu. Chybné album nebo fotka se přeskočí a import
  vypíše, co a proč.

## Celek

```yaml
verze: 4
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
| `hodnoceni` | 1–5 srdíček |
| `narozeni_datum` (`RRRR-MM-DD`), `narozeni_misto`, `narodnost`, `etnicita` | Základní údaje |
| `vyska_cm`, `vaha_kg`, `hrudnik_cm`, `pas_cm`, `boky_cm`, `miry`, `velikost_prsou`, `prsa_typ`, `vlasy`, `oci`, `ochlupeni` | Vzhled; `miry` se zapisují jen bez všech tří obvodů |
| `tetovani`, `piercing` | `ano` / `ne` |
| `prsa_typ` | `Přírodní` / `Silikonová` |
| `ochlupeni` | `Oholené` / `Zastřižené` / `Přírodní` |
| `role`, `vystoupeni`, `pictorial_vydani` | Zařazení |
| `titulni_fotka`, `vyrez` (`zoom`, `poloha_x`, `poloha_y`) | Titulní fotka a její výřez |
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
| `typ` | `Pictorial` nebo `Centerfold` (covery mají vlastní oddíl) |
| `pridano` | Kdy přibyla první fotka alba |
| `vydani` | Jen u pictorialu: `RRRR-MM`, `RRRR` (jen ročník), s edicí `-CZ` |
| `fotograf`, `popis` | Fotograf a text alba (víceřádkový text jako blok `|-`) |
| `spojit` | Stránky tvoří jeden spojený plakát |
| `rucni_poradi` | Fotky jsou v souboru v ručně určeném pořadí; jinak se album řadí podle srdíček |
| `dalsi_modelky` | Další modelky alba (odkazy na modelku); album je zapsané jen u hlavní modelky |
| `netyka_se` | `text`, `vydani` – co se alba netýká |
| `fotky` | Fotky alba; může být prázdné (`[]`), když albu zbyl jen text nebo další modelky |

Fotka: `id` (ID souboru na Google Disku nebo odkaz na něj), `hodnoceni` (1–5), `rotace` (90, 180, 270)
a `pridano`, jen když se liší od data přidání alba.

## Cover, vydání, výběr

```yaml
covery:
  - vydani: 2014-02       # RRRR-MM nebo RRRR-MM-CZ
    spojit: true          # nepovinné
    rucni_poradi: true    # nepovinné
    fotky: [{id: ...}]
vydani:
  - vydani: 1995-S01      # speciál: rok, S a pořadí v roce (s edicí 1995-S01-CZ)
    nazev: Playmate Review  # název má jen speciál
  - vydani: 2014-02
    stav: shanim          # mam (mám výtisk) | shanim | nezajima
    modelka_obalky: Anna  # odkaz na modelku
    poznamka: ...
vybery:
  - nazev: Nejlepší
    fotky:
      - {modelka: Anna, album: Les, typ: Pictorial, id: ...}   # u coveru bez modelky
```

## Uzavřené výčty

U `prsa_typ` a `ochlupeni` nezáleží na velikosti písmen, uloží se v tvaru z nabídky formuláře; jiná
hodnota se ohlásí a stávající údaj zůstane. Hodnoty `typ` alba, edice (`US` bez přípony, `CZ`), `stav` čísla a klíče `netyka_se` jsou pevné. Další
verze programu je mohou jen rozšiřovat, existující hodnoty se nemění.

## Historie formátu

| Verze | Program | Změna |
|---|---|---|
| 5 | 0.13.0 | Speciály (`RRRR-Snn`) a jejich `nazev` u vydání, stav čísla `mam` |
| 4 | 0.10.0 | Kontrola verze, `cislo` a odkazy `Jméno [číslo]`, `netyka_se` u modelky i alba, `pridano` u fotky, `spojit` a `rucni_poradi` u coveru, alba bez fotek |
| 3 | 0.9.0 | Odkazy modelky, vydání (stav, obálka, poznámka), výběry |
| 2 | 0.6.0 | Další modelky alba |
| 1 | 0.3.0 | První podoba |
