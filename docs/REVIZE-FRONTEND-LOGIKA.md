# Revize frontendu – aplikační logika

Revize 23. 10. 2026, verze 0.99.5. Rozsah: `frontend/src/app/*.js`, `frontend/src/lib/*.js`, `frontend/src/main.js`
(stav, navigace a Zpět, souběh načítání, posluchače a pozorovatelé, chyby backendu, XSS, klávesnice a Esc,
localStorage, Statistiky, Přehled, Kalendář, Galerie, Profil, formuláře). Kód se při revizi neměnil.

Ověření: `npm run build`, `npm test` (25/25) a `npm run typy` projdou bez chyb. Nález 1 je ověřený v Chromiu
(Playwright nad `frontend/dist` s napodobeným `window.go`), ostatní nálezy čtením kódu na uvedených řádcích.

## 1. Souhrn

Logika frontendu je v dobrém stavu. Souběh načítání pohledů hlídá `stav.cisloNacteni` ve všech hlavních
pohledech. HTML se skládá důsledně přes `esc()`: `formatMarkdown`/`markdownVRadku` nejdřív escapují a teprve potom
vkládají vlastní značky, odkazy modelky propouštějí jen `http(s)` a nenašel jsem žádný neošetřený údaj
z Disku, importu ani z textu uživatele. Backend chyby neposílá jako odmítnutý slib, ale událostí `chyba`
a prázdnými hodnotami, takže chybějící `catch` u čtení prakticky nevadí.

Hlavní nalezená chyba pochází z 0.99.4: dotaz „Zahodit změny?“ se u článku a u Doplnit modelku ukáže **pod**
oknem. Nedá se na něj kliknout a Esc ho jen znovu otevře, takže rozepsaný článek jde zavřít jen uložením.
Další dvě opravy pro betu: Zpět do Statistik zruší výběr (křížový filtr) a Zpět může otevřít profil smazané nebo
sloučené modelky.

## 2. Nálezy

| # | Závažnost | Kde | Co je špatně a jak se projeví | Návrh opravy | Typ | Prac. | Jistota |
|---|---|---|---|---|---|---|---|
| 1 | **chyba** | `sablona.js:566` (deleteModal) vs. `:744` (clanekModal), `:792` (doplnitModal); `nabidky.js:248`; `klavesnice.js:11–16`; `ulozeni.js:71` | Všechna okna mají `z-index: 1600`, takže o pořadí rozhoduje pořadí v DOM. Potvrzovací okno (`deleteModal`) leží v DOM před oknem článku a Doplnit modelku. **Postup:** číslo → ✎ upravit článek → něco napsat → Esc (nebo Zrušit/×). Objeví se „Zahodit změny?“, ale je zakryté oknem článku: klik na Zahodit neprojde a další Esc vybere „poslední“ okno (`.pop()` = článek) a dotaz otevře znovu. Tab drží fokus v článku. Okno tak jde zavřít jen uložením, případně slepým Enterem na skrytém Zrušit. Stejně se chová Doplnit modelku. Ověřeno v Chromiu: `elementFromPoint` na tlačítku dotazu vrací `clanekModal`, po druhém Esc zůstanou otevřená obě okna. U `modelModal`, `quickModal` a `albumModal` (v DOM dřív) dotaz funguje. | Před zobrazením dotazu přesunout `deleteModal` na konec rodiče (`deleteModal.parentElement.append(deleteModal)` v `potvrdit` i `otevritDeleteModal`). Tím se opraví vrstvení, Esc (`.pop()`) i past na Tab najednou. Případně přidat `#deleteModal, #pickModal { z-index: 1700 }` a v Esc/Tab dát `deleteModal` přednost. | **PATCH (beta teď)** | S | ověřeno |
| 2 | **chyba** | `statistiky.js:480`, `prehled.js:243–274`, `navigace.js:91–93` | Zpět do Přehledu volá `nacistGalerii` → `nacistPrehled`, ten přestaví celý `#stats` a `nacistStatistiky` zavolá `filtry.clear()`. **Postup:** Statistiky → vybrat roky 1992–2003 (nebo kategorii) → klik na modelku v seznamu → profil → Esc/Zpět. Výběr je pryč a s ním zmizí i místo stránky, protože obsah se dopočítá až po obnovení `scrollTop`. To ruší hlavní postup z 0.95/0.96: projít modelky výběru jednu po druhé. | Výběr nemazat při každém načtení, jen při změně dat. Podmínky v `filtry` se vyhodnocují nad `data.modelky`, takže po novém načtení fungují dál. Stačí z ř. 480 odebrat `filtry.clear()`, případně ho volat jen tehdy, když se změnil počet modelek nebo `GetStatistiky` vrátil jiná data. | **PATCH (beta teď)** | S | ověřeno (kód) |
| 3 | chyba (nízká) | `navigace.js:85–86`, `profil.js:24`; `app.go:1726` | Historie drží objekt modelky. Když modelka mezitím zmizí (Smazat, Sloučit modelky), `otevritDetailModelky` použije záložní starý objekt (`… \|\| modelka`). **Postup:** profil B → hledáním do profilu A (B jde do historie) → ⋯ Sloučit s jinou modelkou → B → Zpět. Ukáže se profil B, který už neexistuje: bez alb, ale s údaji a tlačítkem Upravit. Uložení úpravy „projde“, protože `UpdateModelka` nekontroluje počet změněných řádků. Fotky se nezapíšou (cizí klíč). | V `zpet()` u položky `profil` ověřit, že modelka je v `vsechnyModelky()`. Když není, položku přeskočit a vzít další. Volitelně v `otevritDetailModelky` s `bezHistorie` vrátit `false`, když modelka neexistuje. | **PATCH (beta teď)** | S | ověřeno (kód) |
| 4 | riziko | `statistiky.js:530–560` | Tažení v grafu používá `setPointerCapture`, ale chybí obsluha `pointercancel` a `lostpointercapture`. Když tažení přeruší systém (Alt+Tab, systémové gesto, ztráta okna ve WebKitGTK), `tah` zůstane nastavený. Výběr pak jezdí za myší bez stisknutého tlačítka, bublina se neukazuje (`!tah`) a podmínka se nastaví až při dalším puštění tlačítka kdekoli ve Statistikách. | Přidat `pointercancel` a `lostpointercapture`: `tah = null` a `vykreslit(koren, { jenGraf: true })`, aby se vrátil předchozí výběr. | **PATCH (beta teď)** | S | ověřeno (kód) |
| 5 | riziko | `doplneni.js:175–208` (klikací volby), `ulozeni.js:108–113` | Ochrana z 0.99.4 pozná změnu jen podle událostí `input`/`change`. V Doplnit modelku se srdíčka a titulní fotka volí klikem (`stav.doplnovaneHodnoceni`, `doplnovanaTitulni`), takže okno se po jejich volbě zavře Esc bez dotazu a volba se ztratí. Podobně „Otevřít profil“, „+ fotky“, „Doplnit centerfold“ a „Text alba“ zavírají okno přímo a zahodí i napsané údaje. | V klikových větvích nastavit `doplnitModal.dataset.zmeneno = '1'`. Tlačítka, která okno opouštějí, posílat přes `zavritOkno(doplnitModal)` a pokračovat až po potvrzení, případně předtím uložit. Navazuje na nález 1. | **PATCH (beta teď)** | S | ověřeno (kód) |
| 6 | zlepšení | `ulozeni.js:249–252`, `clanky.js:164–166` | Příznak `zmeneno` maže jen změna třídy okna. (a) Po „Uložit a další album“ okno zůstane otevřené s příznakem, takže Esc nad vyprázdněným formulářem se zbytečně zeptá. (b) Smazat článek → Zrušit vrátí okno přes `classList.remove('hidden')`, příznak zmizí a rozepsané změny už ochranu nemají. | (a) Po vyprázdnění polí `delete albumModal.dataset.zmeneno`. (b) Po opravě nálezu 1 už není třeba okno článku před dotazem schovávat, dotaz se ukáže nad ním. | **PATCH (beta teď)**, spolu s #1 | S | ověřeno (kód) |
| 7 | zlepšení | `statistiky.js:486`; `prehled.js:274, 277` | Každé `nacistPrehled` při otevřené části Statistiky (po každém uložení, „Zobrazit další“, Zpět) vytvoří nový `ResizeObserver` a starý neodpojí. Ten jen ověří `isConnected` a skončí, ale drží odpojený strom DOM. Navíc se `GetStatistiky` volá dvakrát (graf desetiletí i Statistiky). | Odkaz na pozorovatele uložit v modulu a před vytvořením nového volat `disconnect()`. Výsledek `GetStatistiky` z `nacistPrehled` předat do `nacistStatistiky`. | PATCH (po 1.0) | S | ověřeno (kód) |
| 8 | riziko | `vydani.js:26, 262` (vs. `profil.js:22–27`) | `otevritVydani` a `otevritFotografa` zapisují do historie **před** kontrolou `cisloNacteni`. Když předchozí volání předběhne další (dvojklik při pomalém backendu nebo rychlé klikání na štítky čísel), uloží se stejné místo dvakrát a Zpět pak jednou „nic neudělá“. Profil to už dělá správně (zápis až po kontrole). | Přesunout `zapamatovatMisto` za kontrolu `moje !== stav.cisloNacteni` (pohled se do té doby nemění) a v `zapamatovatMisto` nepřidávat místo shodné s vrcholem historie. | PATCH (po 1.0) | S | pravděpodobné |
| 9 | zlepšení | `galerie.js:293–297`, `galerie.js:44` | Srdíčka: nová hodnota se počítá z `modelka.hodnoceni`, který se mění až po `await SetHodnoceni`. Dva rychlé kliky na totéž srdíčko (záměr „zrušit“) proto uloží dvakrát stejnou hodnotu. | Hodnotu nastavit hned (optimisticky) a při neúspěchu vrátit, nebo kliky na řadu blokovat do dokončení. | PATCH (po 1.0) | S | pravděpodobné |
| 10 | zlepšení | `sprava.js:37, 157, 163` | `localStorage` se tu jako jediné místo v kódu volá bez `try`. Kdyby úložiště nebylo dostupné, `kontrolaPoSpusteni` při startu vyhodí neošetřenou výjimku a denní kontrola Disku neproběhne. Ve WebKitGTK je to nepravděpodobné. | Obalit stejně jako jinde (`try { … } catch {}`). | PATCH (po 1.0) | S | ověřeno (kód) |
| 11 | MINOR | `ulozeni.js:69–113`, `nabidky.js:245–264`, `klavesnice.js:11–16`, více modulů | Vrstvy (okna, prohlížeč, čtečka, panel filtrů, nabídka, přehled zkratek) nemají společný zásobník. „Horní“ vrstvu hledá každý modul sám (`.pop()` podle DOM, vlastní priority v `zkratky.js`, `volby.js`, `statistiky.js`). Sledování rozepsaných změn závisí na událostech, ne na stavu formuláře. Nálezy 1, 5 a 6 jsou příznaky téhož. | Malý správce vrstev (otevřít/zavřít = push/pop, Esc a Tab vždy na vrchol, `z-index` podle pořadí otevření). Rozepsaná změna = porovnání hodnot formuláře se stavem při otevření. Patří do **1.14 Editor I** (ochrana textu) a **1.19 Přístupnost** (fokus a vrstvy). Případně jako nové téma **1.22 Spolehlivost rozhraní** (zásobník vrstev, historie podle id, životní cyklus pozorovatelů – nálezy 7 a 8). | MINOR → 1.14 / 1.19, nebo nová 1.22 | M | – |

Prošlo bez nálezu: escapování HTML (všechny `innerHTML` v `app/`, `ui/`, `lib/changelog.js`), Markdown (nejdřív
`esc`, pak značky; regex mluvčího nemůže vložit atribut), odkazy (`^https?://`), výsledky hledání (`zvyraznit`
escapuje po znacích), souběh v galerii, stěně, číslech, kalendáři, Nejlepších, Přehledu, profilu a vydání
(`cisloNacteni`), zastaralá alba po rychlém přepnutí modelky (`nacistFotkyModelky` hlídá id), pozorovatelé
postupného načítání (`obrazky.js:41–54` odpojuje starého), listování v kalendáři (token `listovani`), úprava výřezu
(posluchače se odebírají), Esc v našeptávači, nabídce, panelu filtrů a Statistikách (`stopPropagation` ve správném
pořadí), hodnoty z `localStorage` (vždy ověřené proti povoleným hodnotám).

## 3. Opravy pro betu (PATCH teď)

### #1 Dotaz „Zahodit změny?“ pod oknem (+ #6)
- **Oprava:** v `formular-modelky.js` na začátku `potvrdit()` i `otevritDeleteModal()` přidat
  `deleteModal.parentElement.append(deleteModal);`. Okno se tak ocitne poslední v DOM. Vrstvení podle DOM, výběr
  okna pro Esc v `nabidky.js:248` i past na Tab v `klavesnice.js:14` pak automaticky vyberou dotaz. Přesun spustí
  `MutationObserver` jen u třídy, ne u přesunu, takže na `predOtevrenim` v `klavesnice.js` to nemá vliv. V `clanky.js:164–166`
  potom nebude potřeba okno článku schovávat a znovu ukazovat (#6b). V `ulozeni.js` po „Uložit a další album“ přidat
  `delete albumModal.dataset.zmeneno` (#6a).
- **Test:** Playwright nad `dist` s napodobeným `window.go` (stačí Proxy vracející prázdné hodnoty). Postupně
  otevřít `clanekModal`, `doplnitModal`, `modelModal`, `quickModal`, napsat znak a stisknout Esc. Očekává se, že
  `elementFromPoint` na `#cancelDeleteBtn` je uvnitř `#deleteModal`, druhý Esc zavře jen dotaz a okno zůstane, a
  klik na Zahodit zavře obojí. Ruční scénář na Fedoře: číslo → ✎ upravit → psát → Esc → Zahodit.

### #2 Zpět do Statistik ruší výběr
- **Oprava:** v `statistiky.js` odebrat `filtry.clear()` z `nacistStatistiky` (ř. 480). Výběr pak drží jen
  `filtry` a ruší ho uživatel (štítky, „Zrušit výběr“, Esc) nebo změna edice či druhu výskytu. Kdyby měl výběr
  po změně dat zmizet, porovnat `s.centerfoldu` a počet modelek s předchozím `data` a mazat jen při rozdílu.
  Volitelně v `zpet()` obnovit `scrollTop` až po dokreslení Statistik: `nacistStatistiky` vrátí slib,
  `nacistPrehled` ho předá dál.
- **Test:** čistá funkce pro rozhodnutí „zachovat výběr“ (`zachovatVyber(stara, nova)`) v `lib/` s jednotkovým
  testem. Ruční scénář: Statistiky → výběr období → modelka ze seznamu → Esc. Štítek výběru zůstane a seznam
  ukazuje stejné modelky.

### #3 Zpět na smazanou nebo sloučenou modelku
- **Oprava:** v `navigace.js:zpet()` cyklus: dokud je na vrcholu `profil` a jeho id není v `await vsechnyModelky()`,
  položku zahodit (`historie.pop()`). Teprve potom otevřít, co zbylo. Totéž zvážit pro `popisZpet()`, aby tlačítko
  neukazovalo jméno neexistující modelky (stačí kontrola při `zpet`).
- **Test:** ruční scénář ze sloupce „Co je špatně“ (Sloučit modelky → Zpět → otevře se předchozí existující místo).
  Jednotkově jde vyčlenit čistou funkci `platnaHistorie(historie, idModelek)` do `lib/` a otestovat ji.

### #4 Přerušené tažení ve Statistikách
- **Oprava:** v `statistiky.js:pripravit` přidat obsluhu
  `['pointercancel', 'lostpointercapture'].forEach(t => stats.addEventListener(t, …))`, která při `tah` provede
  `tah = null` a překreslí graf (`vykreslit(koren, { jenGraf: true })`). Výběr zůstane takový, jaký byl před tažením.
- **Test:** Playwright: na `[data-sp-graf].cas` vyvolat `pointerdown`, pak `pointercancel`, pak `pointermove` bez
  tlačítka. Štítek výběru se nezmění a bublina se ukazuje.

### #5 Doplnit modelku – volby klikem bez ochrany
- **Oprava:** v `doplneni.js` při volbě srdíček a titulní fotky (ř. 187, 199) nastavit
  `doplnitModal.dataset.zmeneno = '1'`. Tlačítka, která okno opouštějí (Otevřít profil, + fotky, Doplnit centerfold,
  Text alba), při `zmeneno` nejdřív zavolat `potvrdit('Zahodit změny?', …)` (stejný text jako `zavritRozepsane`).
  Závisí na #1, jinak by dotaz byl opět pod oknem.
- **Test:** Playwright: otevřít Doplnit modelku (mock `GetPrehled` s jednou modelkou), kliknout na srdíčko, Esc.
  Musí se objevit dotaz.

## 4. Návrh rozdělení do vydání

Podle pravidla verzování (beta = jen opravy chyb, každá změna = nová PATCH verze se zápisem v changelogu):

| Verze | Obsah | Nálezy |
|---|---|---|
| 0.99.6 | Dotaz „Zahodit změny?“ nad oknem článku a Doplnit modelku, Esc a Tab na dotazu; ochrana i pro volby klikem v Doplnit modelku a po zrušení mazání článku | #1, #5, #6 |
| 0.99.7 | Statistiky: výběr po návratu Zpět zůstává; přerušené tažení výběr nerozbije | #2, #4 |
| 0.99.8 | Zpět přeskočí smazanou nebo sloučenou modelku | #3 |
| 1.0.0 | beze změny (jen číslo verze, datum) | – |
| 1.0.x (PATCH po 1.0) | Odpojení `ResizeObserver` a jedno `GetStatistiky`; historie bez zdvojení při souběhu; srdíčka bez souběhu dvou kliků; `localStorage` v `sprava.js` v `try` | #7, #8, #9, #10 |
| 1.14 Editor I (MINOR) | rozepsané změny podle porovnání stavu formuláře místo událostí (sjednotí ochranu textu všech oken) | #11 (část) |
| 1.19 Přístupnost (MINOR) | zásobník vrstev: jedno místo pro Esc, Tab, fokus a `z-index` | #11 (část) |
| návrh 1.22 Spolehlivost rozhraní (MINOR) | když se #11 nevejde do 1.14/1.19: správce vrstev, historie podle id, životní cyklus pozorovatelů, test rozhraní v Playwrightu s napodobeným backendem jako součást `npm test` | #7, #8, #11 |

Pozn.: opravy 0.99.6–0.99.8 jsou malé a nezávislé a dají se vydat i jako jedna verze 0.99.6. Před 1.0.0
(6. 11. 2026) stačí na Fedoře projít ruční scénáře z oddílu 3.
