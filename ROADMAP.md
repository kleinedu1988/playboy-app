# Roadmapa

Stav k 18. 10. 2026, verze **0.50.0 – alfa**. Hotové změny jsou v `CHANGELOG.md`, drobné nápady a rozhodnutí
v `PLAN.md`. Předchozí podoby roadmapy jsou v historii gitu (etapy 0–6 ve značce `v0.9.0`, etapy 7–10
ve verzi 0.34.7).

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc.

## Kde jsme

Etapy 7–10 (opravy po auditu, pevné schéma, rozhraní na dlouhou trať, příprava k vydání) jsou hotové.
Mezi verzemi 0.14 a 0.34 navíc přibylo víc, než původní plán počítal:

- import YAML i Markdownu, formát exportu verze 7 (`EXPORT.md`, `vzor-exportu.yaml`),
- čísla časopisu jako plnohodnotné stránky: obsah podle stran, články, skeny stran, speciály, edice US a CZ,
- fulltextové hledání v článcích a textech alb (SQLite FTS5), cílené hledání, rozsahy, vylučování,
  tolerance překlepů a našeptávání, stejné ve všech přehledech,
- nový Přehled: mapy edic, Údržba jako fronta úkolů, Sháním CZ, Statistiky a vývoj modelek v čase,
- sjednocené rozhraní: lišta voleb s filtry, skleněné panely, prázdné stavy, kostry při načítání,
  přehled klávesových zkratek, jednotné kontextové nabídky.

Z původních etap 13 a 14 je hotové: Ctrl+F do hledání, seznam „Sháním“ ke zkopírování, hledání v kalendáři,
přepínač řazení galerie, naposledy přidané modelky na úvodu Přehledu a rozbory sbírky ve Statistikách.

## Číslování do 1.0.0

| Fáze | Verze | Co se smí měnit |
|---|---|---|
| Alfa | 0.50.x | jen opravy a doladění rozhraní; schéma (úprava č. 11) a export (verze 7) zmrazené |
| Beta | 0.90.x | jen opravy chyb; zmrazené i funkce a texty |
| Vydání | 1.0.0 | jen číslo verze, datum v changelogu a značka |

Od 1.0.0 platí sémantické verzování naplno: změna schématu nebo exportu, která by starší verzi rozbila,
znamená 2.0.0. Zmrazení hlídá test `TestZmrazeniAlfy`; kdyby se v alfě ukázala nutná změna schématu nebo
exportu, je to vědomé rozhodnutí s novou MINOR verzí a úpravou testu, ne tichá oprava.

## Etapa 11 – Alfa (0.50.x) – probíhá

Cíl: program používat na skutečné sbírce; vše, co se najde, je oprava.

| Co | Proč | Prac. |
|---|---|---|
| ~~Zmrazení schématu a exportu testem, popis v README a `EXPORT.md`~~ – hotovo v 0.50.0 | Pojistka proti nechtěné změně | S |
| Používání na skutečné sbírce (v kopii), zápis chyb do `PLAN.md` a jejich oprava v 0.50.1, 0.50.2… | Chyby, které testy nenajdou | M |
| Poblikávání okna ve WebKitGTK: ověřit opravu z 0.33.18 na Fedoře, případně proměnné prostředí v `instalovat.sh` | Hlášené, oprava zatím nepotvrzená | S |
| Zátěžová zkouška na syntetické sbírce (500 modelek, 20 000 fotek): galerie, profil, Přehled, Statistiky, export a import kruhem | Velká sbírka před betou | S–M |
| Audit kódu agenty (data, rozhraní, výkon) a oprava nálezů | Stejně jako po 0.9.0 | M |
| Úzké okno a klávesnice: projít všechny pohledy a okna | Dojem z každodenního používání | S |

## Etapa 12 – Beta (0.90.x)

Cíl: nic nového, jen jistota.

| Co | Proč | Prac. |
|---|---|---|
| Instalace na čistém uživatelském účtu podle README, přenos dat na jiný počítač, obnovení ze zálohy | Ověřit, že postupy v README fungují | S |
| Přechod databáze ze všech dřívějších schémat a import exportů verzí 1–7 | Nikdo nesmí přijít o data aktualizací | S |
| Kontrola textů, nápovědy a „Co je nového“, závěrečné opravy (0.90.1…) | Dojem z vydané verze | S |

## Po 1.0.0

### 1.1 – Každodenní práce

| Co | Proč | Prac. |
|---|---|---|
| Upozornění, že fotka už ve sbírce je u jiné modelky nebo v jiném albu | Duplicity napříč sbírkou program nehlídá | S |
| Pohled „Naposledy přidané“ po dnech (modelky, alba, fotky) | Navázat, kde jsem včera skončil | S |
| Automatické zamčení po nečinnosti | Okno nechané otevřené zůstává přístupné | S |
| Předchozí a další rok na stránce ročníku | Listování ročníky bez návratu do kalendáře | S |
| Evidence „mám PDF“ u americké edice (jen pokud se ukáže potřeba) | US se nesbírá fyzicky, archiv je v PDF | S [schéma] |

### 1.2 – Velká sbírka

| Co | Proč | Prac. |
|---|---|---|
| Rozšířené kontroly v Údržbě: centerfold bez data narození, cover bez modelky z obálky, stejný fotograf zapsaný různě | Kvalita dat ve velkém | M |
| Seznam fotografů k procházení | Stránka fotografa jde otevřít jen z alba | S |
| Rekordy ve Statistikách (nejmladší, nejvyšší, nejvíc obálek…) | Encyklopedický pohled | S |
| Titulní fotka alba pro stránky fotografa a ročníku | Hezčí přehledy alb mimo profil | S–M |

### 1.3 – Editor textů

Cíl: pohodlné psaní článků, rozhovorů, textů alb a poznámek bez ručního psaní formátovacích značek.

| Co | Proč | Prac. |
|---|---|---|
| Editor s nástrojovou lištou (tučné, kurzíva, nadpisy, odrážky, citace) a živým náhledem | Dnes prosté pole, značky se píší zpaměti | M |
| Klávesové zkratky (Ctrl+B, Ctrl+I…), zvětšení na celé okno | Dlouhé texty | S–M |
| Šablony pro rozhovory (mluvčí `PLAYBOY:` / `Jméno:`, perex, citace) | Rychlejší přepis rozhovorů | S–M |
| Jeden editor pro články, alba, poznámky modelek i čísel | Jednotné chování | S–M |

## Rozhodnuto

- Album jako záznam (0.10.0); řazení galerie abecedně, naposledy přidané, rok prvního vydání; speciály zvlášť;
  národní edice US a CZ (0.13.0).
- Výtisky se sbírají jen u české edice (mám výtisk, sháním); americká edice je archiv dat (0.34.2).
- Dvě modelky stejného jména se liší datem narození; data narození a úmrtí RRRR, RRRR-MM nebo RRRR-MM-DD;
  hodnota „-“ v importu údaj smaže; překlep v klíči souboru se opraví na nejbližší známý klíč (0.18.0–0.30.0).
- Vzhled: střídmý, jeden růžový akcent, písmo aplikace i v nadpisech (patkové písmo vráceno v 0.34.1).

## Nedělat

- Obecné Zpět pro všechny úpravy (deník změn) – denní zálohy a Vrátit u fotek stačí.
- Místní kopie fotek, náhledy na disku, zálohy na jiný disk.
- Šifrovanou databázi – zvolen zámek rozhraní.
- Půlsrdíčka.
- Přihlášení k Disku a import celé složky, stahování údajů z webu, rozpoznávání obličejů.
- Nové funkce v alfě a betě a změny schématu nebo exportu od alfy.
- Vše z oddílu „Rozhodnuto nedělat“ v `PLAN.md`.
