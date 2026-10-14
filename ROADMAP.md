# Roadmapa

Stav k 14. 10. 2026, verze 0.11.0 (sestaveno po verzi 0.9.0 ze tří auditů kódu: backend a data, frontend, produkt;
cesta k 1.0.0 rozdělena na přípravu, alfu a betu po verzi 0.11.0).
Nálezy vycházejí ze čtení kódu a z měření na syntetické sbírce (500 modelek, 20 000 fotek v nativním SQLite);
aplikace se při auditu nespouštěla. Drobné nápady a rozhodnutí zůstávají v `PLAN.md`, hotové změny
v `CHANGELOG.md`. Předchozí roadmapa (etapy 0–6) je ve značce `v0.9.0`.

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[DM]** = mění schéma databáze nebo formát exportu.

## Výsledek ověření etap 0–6

Všechny etapy jsou v kódu, většina položek je hotová. Část ale nese chyby, které audit našel:

- **Výkon při velké sbírce.** Počet fotek u modelek, profil a kalendář používají dotazy, které rostou se součinem
  modelek a fotek. Při 500 modelkách a 20 000 fotkách trvá jedno načtení galerie 16,6 s, profil 13,4 s,
  kalendář 5,7 s. Dnešní 4 modelky to nepocítí, při 100 modelkách už asi 0,7 s.
- **Import v transakci** se potvrdí i po chybě zápisu a po dobu importu vyměňuje sdílené připojení k databázi
  bez zámku; souběžná denní kontrola nebo úprava v okně se tak může ztratit. Stejně vyměňuje připojení obnovení
  ze zálohy.
- **„Netýká se“** se smaže uložením alba s prázdným textem, chybí v exportu a v tabulce Vydání nic neudělá.
- **Vrátit po odebrání fotky** může zmizet, když hned po něm přijde jiné oznámení; vrácená fotka navíc
  nedostane zpět členství ve výběrech ani další modelky alba.
- **Slučování** (alb i modelek) ztrácí srdíčka duplicitních fotek, jejich výběry, obálky, odkazy a „netýká se“.
- **Sdílená alba:** smazání hlavní modelky smaže album i ostatním, úprava z profilu další modelky se nepřekreslí.
- **Ovládání:** Esc a Alt+← kolidují s výběrem fotek a s listováním modelek, hledání z profilu hledá v přehledu,
  odkud se přišlo, „Uložit a další“ může modelku přeskočit nebo vrátit.
- **Album a vydání** jsou dál textový klíč u fotek; cover visí na zástupné modelce 0, takže nejdou zapnout cizí
  klíče. Před verzí 1.0.0, která má zmrazit schéma, je potřeba rozhodnout, jestli to tak zůstane.

Otevřené zůstalo: přepínač řazení galerie (čeká na rozhodnutí), dokončení rozdělení `main.js`, kontrola typů.

## Etapa 7 – Opravy (0.9.1, hotovo 14. 10. 2026)

Jeden dispečer kláves odložen do rozdělení `main.js` (etapa 9); kolize kláves jsou opravené jednotlivě.

Cíl: všechno, co verze 0.9.0 slibuje, funguje i při stovkách modelek a nic se tiše neztrácí.
Bez změny schématu a formátu exportu.

| Co | Proč | Prac. |
|---|---|---|
| Odstranit kvadratické dotazy (počet fotek, profil, kalendář, dvojí načítání modelek v Přehledu) a přidat výkonnostní test 500 / 20 000 | Galerie by při 500 modelkách naběhla za 16 s | S–M |
| Import bez výměny připojení: transakce předávaná pomocným funkcím, vrácení i při chybě zápisu, zámek proti souběžným voláním; totéž u obnovení ze zálohy | Polovičatý import, ztracené souběžné zápisy | M |
| Oznámení s tlačítkem Vrátit nesmí přepsat jiné oznámení; Vrátit obnoví i výběry a další modelky alba | Vrátit je u odebrání jedné fotky jediná pojistka | S–M |
| „Netýká se“: neztrácet ho při uložení alba, v tabulce Vydání ho nahradit stavem „nezajímá mě“ | Práce v Přehledu se tiše ztrácí | S |
| Slučování beze ztrát: nejvyšší hodnocení a výběry duplicitní fotky, obálky, odkazy, „netýká se“ | Sloučení teď maže údaje | S–M |
| Sdílená alba: smazání hlavní modelky album předá další modelce (nebo varuje), překreslení z profilu další modelky, varování při mazání sdíleného alba | Ztráta společného pictorialu bez varování | S–M |
| Jeden dispečer kláves s pořadím okno > nabídka > prohlížeč > výběr > stránka; výběr fotek se při odchodu z profilu zruší | Esc a Alt+← dnes dělají něco jiného, než se čeká | S–M |
| Hledání z profilu nebo vydání přepne na Modelky a zapíše se do historie; totéž klik na štítek | Hledání z podstránky hledá ve špatném přehledu | S |
| „Uložit a další“ nad pevnou frontou modelek, kterým chybí právě daná skupina | Modelka se teď může přeskočit nebo vrátit | S–M |
| Start nad poškozenou databází nebo databází z novější verze: jen čtení, žádné úpravy schématu | Dnes se po varování dál zapisuje | S |
| Kontrola dostupnosti: dávka bez vyhladovění, zápisy v transakci, ověření při vložení se uloží; šablona adresy obrázků se před uložením ověří a po obnovení ze zálohy znovu načte | Chybná šablona by označila celou sbírku jako nedostupnou | S |
| Řazení a hledání s cizími písmeny (Ł, Ø) stejně v Go, SQL i v rozhraní; ochrana cíleného hledání před krátkými hodnotami vydání | „Émilie“ se na stěně řadí za Z, jedna stará hodnota by hledání shodila | S |
| Mezipaměť pohledu se zapíše až po kontrole, že odpověď není zastaralá | Nejlepší mohou po rychlém přepnutí ukázat jiná data | S |

## Etapa 8 – Pevné schéma (0.10.0) – hotovo

Album jako záznam přijato („pokračuj“ = ano rozhodnutí 1). Edice a stavy čísla jsou uzavřené výčty v kódu
(rozšíření nevyžaduje změnu schématu), takže rozhodnutí 3 a 4 tuto etapu neblokují.

Cíl: databáze a formát exportu mají podobu, která se po 1.0.0 už nebude lámat; export → úprava v editoru →
import neztratí nic. Podmínka verze 1.0.0, uživatel nové funkce neuvidí.

| Co | Proč | Prac. |
|---|---|---|
| Album jako záznam: fotky odkazují na `album_id`, vydání a fotograf jsou u alba, prázdné album smí existovat **[DM]** | S poslední fotkou dnes mizí text, „netýká se“ i další modelky alba; ~30 dotazů spojuje tabulky přes text | L |
| Cover bez zástupné modelky 0, zapnuté cizí klíče **[DM]** | Integritu dnes drží jen spouštěče | L (spolu s předchozím) |
| Vydání jako sloupec u všech typů s indexem, edice zvlášť nebo jako uzavřený výčet **[DM]** | Dnešní výraz neumí index, US a CZ jsou jen přípona | M–L |
| Rámec migrací: zmrazit úpravu č. 1, chyby nezamlčovat, každá úprava v transakci s číslem schématu, testy na databázích z verzí 0.4–0.9 | Dnes neúspěšná úprava stejně zvýší číslo schématu | S–M |
| Formát exportu verze 4 **[DM]**: kontrola verze (novější soubor se odmítne), stálé identifikátory místo jmen, chybějící údaje („netýká se“, datum přidání každé fotky, pořadí coverů), test kruhu porovnávající obsah databáze, popis v `EXPORT.md` | Dvě modelky stejného jména se dnes při importu slijí, novější soubor se tiše načte bez nových údajů | M |
| Kontrola vstupu v backendu jedním pravidlem pro zápis i import (typ alba, název centerfoldu, vydání, klíče „netýká se“) | Backend dnes přijme, co import pak odmítne | S |
| Uzavřít výčty: edice, stavy čísla, typy alb **[DM]** | Po 1.0 jen rozšiřovat, neměnit | S |

## Etapa 9 – Rozhraní na dlouhou trať (0.11.0) – hotovo

Cíl: každou akci jde udělat odkudkoli a bez pravého tlačítka, rozhraní snese stovky modelek a jde dál rozvíjet
bez chyb typu „akce v jednom pohledu překreslí jiný“.

| Co | Proč | Prac. |
|---|---|---|
| Dokončit rozdělení `main.js`: sdílený stav (`stav.js`), mezipaměť modelek (`data/modelky.js`), sběrnice změn (`udalosti.js`), navigace a historie, prohlížeč, klávesy, pohledy a formuláře po souborech | 3 700 řádků a 63 globálních proměnných v jednom souboru; `GetModelky` se volá ze 14 míst | L |
| Kontrola typů (`tsc` s JSDoc po souborech, typy z `wailsjs/go/models.ts`) | Překlepy ve vlastnostech a volání backendu | M |
| Akce fotky bez pravého tlačítka: ⋯ na dlaždici, lišta v prohlížeči (Do výběru, profil, Disk, Odebrat); výběry přidávat odkudkoli | Dnes jen pravým tlačítkem a jen z profilu | M |
| Výběr více fotek i na stránce vydání, ročníku, fotografa a v Nejlepších; Delete a „vybrat vše“ | Dnes jen v profilu | M |
| Výkon Nejlepších a výběrů (zkrácení po modelkách nebo `content-visibility`), odstranit O(n²) skládání indexů | Při prahu 3+ desítky tisíc prvků najednou | M |
| Přístupnost klávesnicí: fokusovatelné karty a dlaždice, nabídka ovladatelná šipkami, fokus v modálních oknech | Profil ani fotku dnes nejde otevřít klávesnicí | M |
| Sjednotit texty („Upravit“ vs. „Editovat“, „Do výběru“), skloňování v `lib/` s testem, hlášky „přidej pravým tlačítkem“ | Drobné nekonzistence | S |

## Cesta k 1.0.0

Mezi 0.11 a 1.0 je velký skok, proto jde po etapách s předběžnými verzemi podle sémantického verzování:
poslední funkční etapa (0.12.0–0.14.0: import v 0.12.0, rozhodnutí a instalace v 0.13.0, nápověda a úvod v 0.14.0), alfa (`1.0.0-alpha.N`), beta (`1.0.0-beta.N`) a vydání 1.0.0. Od alfy se
nemění schéma databáze ani formát exportu; od bety ani funkce a texty. Před alfou je proto potřeba uzavřít
rozhodnutí, která schéma nebo export ovlivňují (3 a 4, případně 2).

## Etapa 10 – Příprava k vydání (0.13.0–0.14.0) – hotovo

Cíl: program jde nainstalovat do nabídky aplikací a začít s prázdnou sbírkou bez README; nápověda a novinky
jsou v programu. Poslední etapa, ve které smí přibýt funkce a změnit se schéma nebo export.

| Co | Proč | Prac. |
|---|---|---|
| ~~Úvod prázdné sbírky: sdílení na Disku „kdokoli s odkazem“, první modelka, import YAML, volitelně heslo~~ – hotovo v 0.14.0 | Dnes jediný řádek s odkazem na tlačítko + | S–M |
| ~~Okno nápovědy (klávesa `?` a položka v ⋯): klávesy prohlížeče, cílené hledání, srdíčka, Přehled, výběry~~ – hotovo v 0.14.0 | Dnes jen v nápovědách po najetí a v README | S–M |
| ~~„Co je nového“: changelog vložený do programu, po aktualizaci se jednou ukáže~~ – hotovo v 0.14.0 | Položka Verze dnes odkazuje na soubor v repozitáři | S |
| ~~Instalace do `~/.local/bin` s položkou v nabídce aplikací a ikonou; v README odinstalace a přenos dat na jiný počítač~~ – hotovo v 0.13.0 (`instalovat.sh`) | Program dnes existuje jen jako soubor v `build/bin` | S |
| ~~„Smazat celou databázi“ hlouběji nebo s napsáním potvrzovacího slova~~ – hotovo v 0.14.0 | Pohodlí a jistota | S |
| ~~Rozhodnutí 2–4 promítnout do kódu (řazení galerie, výtisky, speciály)~~ – hotovo v 0.13.0 | Po alfě už to nepůjde bez nové hlavní verze | S–M |
| ~~Předběžné verze v číslování: `TestVerzeSouhlasi` a `wails.json` přijmou `1.0.0-alpha.N` a `1.0.0-beta.N`~~ – hotovo v 0.14.0 | Připravit číslování pro další etapy | S |

## Etapa 11 – Alfa (1.0.0-alpha)

Cíl: zmrazit schéma a formát exportu a program používat na skutečné sbírce; vše, co se najde, je oprava.
**Nová úprava schématu ani nová verze exportu už nevznikne.**

| Co | Proč | Prac. |
|---|---|---|
| Zmrazení: test, že poslední úprava schématu je č. N a export verze M; jejich popis v `EXPORT.md` a README jako závazný | Pojistka proti nechtěné změně | S |
| Audit agenty proti kódu (data, rozhraní, výkon) a oprava nálezů | Stejně jako po 0.9.0 | M |
| Používání na skutečné sbírce (v kopii), zápis chyb do `PLAN.md` a jejich oprava v `alpha.2`, `alpha.3`… | Chyby, které testy nenajdou | M |
| Kontrola na syntetické sbírce (500 modelek, 20 000 fotek): výkon, Přehled, export a import kruhem | Velká sbírka před zmrazením | S |

## Etapa 12 – Beta (1.0.0-beta)

Cíl: nic nového, jen jistota. Zmrazené jsou i funkce a texty.

| Co | Proč | Prac. |
|---|---|---|
| Instalace na čistém uživatelském účtu podle README, přenos dat na jiný počítač, obnovení ze zálohy | Ověřit, že postupy v README fungují | S |
| Přechod databáze ze všech dřívějších verzí (0.4–0.12) a import exportů verzí 1–4 | Nikdo nesmí přijít o data aktualizací | S |
| Kontrola textů a nápovědy, závěrečné opravy chyb z bety (`beta.2`…) | Dojem z vydané verze | S |

## Vydání 1.0.0

Beta bez otevřených chyb se vydá jako 1.0.0: jen číslo verze, datum v CHANGELOGu a značka. Od té doby platí
sémantické verzování naplno: změna schématu nebo exportu, která by starší verzi rozbila, znamená 2.0.0.

## Etapa 13 – Každodenní práce (1.1.0)

Cíl: navázat tam, kde jsem včera skončil, nezaložit duplicitní fotku a mít sháněná čísla po ruce.

| Co | Proč | Prac. |
|---|---|---|
| Pohled „Naposledy přidané“ (podle data přidání, po dnech) | Datum přidání se ukládá od verze 0.4, nikde se neukazuje | S |
| Upozornění, že fotka už ve sbírce je u jiné modelky nebo v jiném albu | Duplicity napříč sbírkou dnes program nehlídá | S |
| Skok do hledání klávesou `/` nebo Ctrl+F | Rychlost | S |
| Automatické zamčení po nečinnosti | Okno nechané otevřené zůstává přístupné | S |
| Seznam „Sháním“ po edicích a letech ke zkopírování | Praktický nákupní seznam | S |
| Hledání v kalendáři i podle modelky a stavu; předchozí a další rok na stránce ročníku; stav a „Upravit číslo…“ u měsíců ročníku | Slabina z `PLAN.md` | S |
| Řádek s rokem prvního vydání a edicí na kartě modelky | Orientace ve stovkách karet bez filtrů | S |
| Přepínač řazení galerie (jedno tlačítko vedle ♡) | Jen pokud ano, viz rozhodnutí 2 | S |

## Etapa 14 – Velká sbírka (1.2.0)

Cíl: sbírku o stovkách modelek rozebírat a hlídat kvalitu dat bez ručního procházení.

| Co | Proč | Prac. |
|---|---|---|
| Rozbory v Přehledu: věk při centerfoldu, desetiletí, fotografové, národnosti, US a CZ vedle sebe | „Encyklopedický“ pohled na sbírku | M |
| Rozšířené kontroly: centerfold bez data narození, cover bez modelky z obálky, stejný fotograf zapsaný různě | Kvalita dat ve velkém | M |
| Seznam fotografů k procházení | Stránka fotografa jde dnes otevřít jen z alba | S |
| Titulní fotka alba pro stránky fotografa a ročníku | Hezčí přehledy alb mimo profil | S–M |

## K rozhodnutí

Rozhodnuto 14. 10. 2026: album jako záznam (1, hotovo v 0.10.0); řazení galerie jen tři – abecedně, naposledy
přidané, rok prvního vydání (2); stav čísla „mám výtisk“ (3); speciály evidovat zvlášť, národní edice zatím
jen US a CZ (4). Vše je v 0.13.0.

Rozhodnuto po auditu 14. 10. 2026 (poslední úprava schématu č. 8 a export verze 6 před alfou):
album bez fotek je plnohodnotné (počítá se jeho vydání, samo nezmizí); dvě modelky stejného jména se musí lišit
datem narození, odkazy na ně v exportu jsou „Jméno (RRRR-MM-DD)“; více odkazů odděleno čárkou nebo novým
řádkem, více fotografů čárkou; datum narození RRRR, RRRR-MM nebo RRRR-MM-DD; u čísla textové pole „na obálce“;
datum úmrtí u modelky; hodnota „-“ v importu údaj smaže; překlep v klíči souboru se opraví na nejbližší známý
klíč s upozorněním, neznámý klíč se ohlásí.
Hotovo v 0.18.0 (úprava schématu č. 8, export verze 6): datum úmrtí, data narození a úmrtí RRRR, RRRR-MM nebo
RRRR-MM-DD, textové pole „na obálce“, „-“ v importu údaj smaže, oprava překlepů v klíčích. Zbývá rozhodnout
a udělat před alfou: dvě modelky stejného jména rozlišené datem narození a odkazy „Jméno (RRRR-MM-DD)“, více
odkazů oddělených čárkou nebo novým řádkem, více fotografů oddělených čárkou.

5. **Instalace:** skript `instalovat.sh` (nabídka aplikací, ikona, odinstalace) je připravený v 0.13.0; zda ho používat, je na uživateli.

## Nedělat

- Lištu filtrů nad galerií ani boční panel s filtry; přepínač řazení zůstane jedním tlačítkem.
- Obecné Zpět pro všechny úpravy (deník změn) – denní zálohy a Vrátit u fotek stačí.
- Místní kopie fotek, náhledy na disku, zálohy na jiný disk.
- Šifrovanou databázi – zvolen zámek rozhraní.
- Půlsrdíčka.
- Přihlášení k Disku a import celé složky, stahování údajů z webu, rozpoznávání obličejů.
- Nové funkce v alfě a betě (etapy 11 a 12) a změny schématu nebo exportu od alfy.
- Vše z oddílu „Rozhodnuto nedělat“ v `PLAN.md`.
