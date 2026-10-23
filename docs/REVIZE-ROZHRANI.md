# Revize rozhraní (0.99.5, 23. 10. 2026)

Rozsah: `frontend/src` (sablona.js, style.css, ui/*.js, app/*.js) – kvalita CSS, texty, klávesnice a čtečka,
kontrast, prázdné a načítací stavy, pohyb, zvláštnosti WebKitGTK. Kód se neměnil. Ověřeno: `npm run build`
(prošel, CSS 100 kB), skripty nad CSS (nepoužité selektory, zdvojené selektory s rozpornými hodnotami),
výpočet kontrastu podle WCAG 2.1 a snímky z Playwright/Chromium s podvrženým `window.go` při šířce 280, 400,
620, 760, 1000 a 1280 px (galerie, Čísla, nabídky, Přehled, Údržba, Statistiky, formulář, zkratky, zámek).

## 1. Souhrn

Rozhraní je v dobrém stavu. Při žádné z testovaných šířek (280–1280 px) stránka nepřetéká do strany. Okna
drží fokus uvnitř a po zavření ho vracejí tam, odkud se otevřela. Kontextová nabídka se dá ovládat šipkami
a má `role="menu"`. Běžný tlumený text má kontrast 5,6–6,8 : 1. `!important` je jen třikrát a pokaždé u
`display: none`, takže se pravidla o přednost nepřetahují. Vrstvy (z-index) jdou ve smysluplném pořadí: lišta
výběru 900 < hledání 1400 < prohlížeč 1500 < okna 1600 < nabídky 2000 < oznámení 2500 < zkratky 2600 < zámek
3000. Pro betu jsem našel pět drobných ověřených chyb a šestou volitelnou:
- na zamčené obrazovce je vidět hledání a dá se do něj psát;
- tři křížky nemají popisek pro čtečku, přestože to 0.99.4 opravovala;
- text článku nemá žádný popisek;
- nápověda Statistik jako jediná v programu vyká a v jedné větě nesedí shoda podmětu s přísudkem;
- (volitelně) u vybraného řádku grafu rozložení není vidět fokus.

Největší dluh CSS: 55 selektorů je zapsaných dvakrát až pětkrát s rozpornými hodnotami (tři vrstvy
„nového stylu“ přes původní pravidla). Je to úklid po 1.0, ne oprava do bety. Většina přístupnosti
(role oken, živé oznámení, názvy ikonových tlačítek, omezení pohybu) patří do 1.19.

## 2. Nálezy

Závažnost: **chyba** = ověřené chování, které je špatně; **riziko** = může se projevit, neověřeno na Fedoře;
**zlepšení** = nic nefunguje špatně, jde to udělat lépe. Prac.: S = do hodiny, M = do dne.

| # | Závažnost | Kde (file:line) | Co je špatně a jak se projeví | Návrh opravy | Typ | Prac. | Jistota |
|---|---|---|---|---|---|---|---|
| 1 | chyba | style.css:2480–2484, sablona.js:14–23 | Zamčený program má podle komentáře v hlavičce nabízet jen tlačítka okna. `#app.zamceno` ale schová jen `.logo` a `.hlavni-lista`, hledání (`.nav-controls`, od přesunu do řádku okna) zůstalo. Na zámku je vidět pole „Hledat modelku…“, Tab z hesla do něj skočí a dá se psát (ověřeno snímkem). Zámek je jen v rozhraní (Go `Odemknout` nic neblokuje), takže psaní spouští dotazy do sbírky za zámkem. | Přidat `.nav-controls` do pravidla zamčeného stavu (viz oddíl 3). | **PATCH (beta teď)** | S | vysoká |
| 2 | chyba | sablona.js:620, 642, 659 | 0.99.4 dala křížkům oken `aria-label`, ale vynechala tři: zavření prohlížeče fotek (`#lbClose`), čtečky stran (`.ctecka-zavrit`) a oznámení (`#toastClose`). Čtečka přečte „krát“ nebo „×“. Totéž platí pro `#winCloseBtn` (28). | Doplnit `aria-label="Zavřít"`. | **PATCH (beta teď)** | S | vysoká |
| 3 | chyba | sablona.js:770 (+355, 442, 775) | `<textarea id="inputClanekText">` nemá popisek, `aria-label` ani placeholder, takže čtečka ohlásí jen „textové pole“. `<label id="bulkLinksLabel">` (355) nemá `for` a s polem odkazů není spojený (klik na popisek nezaměří pole). Heslo zámku (442) a skeny (775) mají jen placeholder. | Viz oddíl 3. | **PATCH (beta teď)** | S | vysoká |
| 4 | chyba | app/statistiky.js:447 | Nápověda pod grafem v čase: „Klik na sloupec vybere rok, tažením **vyberete** období.“ Je to jediné vykání v programu, jinak všude tykání (o dva řádky níž „přepni graf a uvidíš“, nápověda „vybereš“, „zvol“). | „…, tažení myší období.“ (stejně jako nápověda v sablona.js:705). | **PATCH (beta teď)** | S | vysoká |
| 5 | chyba | app/statistiky.js:447 | „`${pocetModelek(bezCisla)}` bez čísla (jen online nebo bez vydání) v grafech v čase **není**.“ Pro 2–4 vyjde „2 modelky … není“, správně je „nejsou“. | Přísudek podle počtu (oddíl 3). | **PATCH (beta teď)** | S | vysoká |
| 6 | chyba | style.css:5930–5938 | `.sp-pruh:focus-visible` dá jen podbarvení `--panel-hover` a `outline: none`. Hned za ním stojí `.sp-pruh.vybrany` se stejnou specificitou, takže u vybraného řádku podbarvení přepíše. Po Enteru na řádku rozložení (výběr hodnoty) tak fokus zmizí a není vidět, kde klávesnice je. | Vlastní obrys pro fokus (oddíl 3). | **PATCH (beta teď)**, volitelně | S | vysoká |
| 7 | zlepšení | style.css (55 selektorů), např. `.context-menu` 489/3528/3591/6150, `.toast` 458/3528/3618/6476/6486, `.modal-card` 816/3666/4254, `.selection-bar` 2620/3528/3538/6214, `.graf-bublina` 6128/6476/6491 | Pravidla „nového stylu“ jsou jako tři vrstvy přes původní pravidla, takže dřívější hodnoty (`border-radius` 8 → 10 → 18 px, pozadí, stíny, odsazení) už neplatí. Vzhled je v pořádku, ale při každé úpravě hrozí, že se změní hodnota, která se pak přepíše. | Sloučit každý selektor do jednoho bloku s výslednými hodnotami. Po sloučení porovnat snímky (vizuální regresní test). | PATCH (po 1.0), údržba | M | vysoká |
| 8 | zlepšení | style.css:6114–6117, 6142 | Mrtvé selektory: `.graf-nazev` a `.stat-pozn` se v JS ani v šabloně nepoužívají (prohledáno mimo komentáře). Žádný jiný nepoužitý selektor se nenašel. | Smazat `.graf-nazev`, ze skupiny `.stat-pozn, .stat-prazdne` nechat `.stat-prazdne`. | PATCH (po 1.0) | S | vysoká |
| 9 | zlepšení | style.css:3700–3715 × 3733–3735 | `.card-info` má `opacity: 0`, přechod a `:hover`/`:focus-visible { opacity: 1 }`, ale pozdější `.card .card-info { opacity: 1 }` je přebije. `.card-info` je jen v kartě (galerie.js:187), takže tahle část pravidla je mrtvá a komentář „ukáže se až po najetí“ neplatí. | Odstranit `opacity`, `transition` a pravidlo 3712–3715, opravit komentář. | PATCH (po 1.0) | S | vysoká |
| 10 | riziko | style.css:606–611 + 671–685 + 3737–3742; 1430 + 2328–2340 | Stejný vzor jako u blikání kalendáře (0.94.4): karta se zaoblením a `overflow: hidden` se při najetí posouvá (`translateY`) a uvnitř se prolíná průhlednost (srdíčka nehodnocené modelky `opacity 0.15s`). U fotky v albu se zase zvětšuje obrázek a prolínají srdíčka. Ve WebKitGTK s akcelerací to může poblikávat. | Na Fedoře vyzkoušet galerii nehodnocených modelek a album. Kdyby to poblikávalo, zrušit přechod průhlednosti (okamžité zobrazení), jako u kalendáře. | PATCH (po 1.0); s potvrzeným blikáním i do bety | S | střední |
| 11 | riziko | style.css:3745–3755 + 3370–3380 | Ovládání prohlížeče se po chvíli prolne do `opacity: 0` (0.25 s) a obsahuje pilulku s `backdrop-filter`. Rozmazání pod rodičem s měnící se průhledností WebKit někdy vykreslí špatně (záblesk nebo zmizení rozmazání). | Ověřit na Fedoře, případně skrývat bez přechodu. | PATCH (po 1.0) | S | nízká |
| 12 | zlepšení | sablona.js:119–792 (13 oken `.modal-overlay`) | Okna nemají `role="dialog"`, `aria-modal="true"` ani `aria-labelledby` na nadpis. Má je jen čtečka stran (633) a přehled zkratek. Orca otevření okna neohlásí. | Doplnit role a odkaz na `<h3>` (nadpisům dát `id`). | MINOR → 1.19 Přístupnost (krok 2) | S | vysoká |
| 13 | zlepšení | sablona.js:653–660, ui/oznameni.js | Oznámení (`#toast`, `#toastInfo`) nemá `role="status"` ani `aria-live`, takže výsledek akce („Vráceno“, chyby) čtečka nepřečte. | `role="status" aria-live="polite"` na oba prvky (chybám případně `assertive`). | MINOR → 1.19 | S | vysoká |
| 14 | zlepšení | sablona.js:11–12, 26–27, 46–47, 591, 615, 622, 645, 647; app/profil.js:272; app/prehled.js:369 | Ikonová tlačítka mají jen `title`, takže jejich přístupný název je symbol: „+“, „⋯“, „–“, „□“, „‹“, „›“. Jinde to už je vyřešené (`tile-more`, `ud-vice`, Nejlepší, Přehled). Tlačítka s nabídkou (`#addBtn`, `#menuBtn`, Přehled) nemají `aria-haspopup="menu"` ani `aria-expanded`, které lišta voleb (ui/volby.js:186–193) má. Záložky `.view-toggle` nemají `aria-pressed` ani `aria-current`. | Doplnit `aria-label`, `aria-haspopup` a `aria-expanded` podle vzoru z volby.js. | MINOR → 1.19 | S | vysoká |
| 15 | zlepšení | style.css:1118–1122 | Placeholder je `--text-muted` s `opacity: 0.5` a na poli okna vychází kontrast **2,3 : 1** (v hledání 2,5 : 1). Placeholdery přitom nesou návod („RRRR-MM-DD, RRRR-MM nebo RRRR“, „Vlož zkopírované odkazy…“). Při 400 px je navíc formát data uříznutý („RRRR-MM-DD, RRR“). | `opacity: 0.75` (asi 4,3 : 1), nebo formát dát do popisku či nápovědy pod pole. | MINOR → 1.19 | S | vysoká |
| 16 | zlepšení | style.css:5250–5255 | `.naseptavac-kod` (kód čísla ve výsledcích hledání, 13 px) má barvu `--accent` (#d81b60), kontrast 3,5 : 1 na skle. Na růžový text je určená barva `--accent-text` (5,2 : 1). | `color: var(--accent-text)`. | MINOR → 1.19 | S | vysoká |
| 17 | zlepšení | style.css:6536, 6696, 6841; app/vydani.js:426, app/listy.js:20, ui/lista.js:46 | `prefers-reduced-motion` vypíná jen otevírání nabídek, vlnu kostry a zkratky. Dál zůstává: posun karet, čísel, stěny, ročníků a buněk kalendáře při najetí (8 přechodů `transform`), plynulé rolování v JS (`behavior: 'smooth'`) a samočinné střídání obrázků na kartě kalendáře. | Při omezeném pohybu přechody vypnout, rolovat s `behavior: 'auto'` a střídání nespouštět. | MINOR → 1.19 | S | vysoká |
| 18 | zlepšení | app/statistiky.js:30 | Malé grafy v úvodu Přehledu (`grafSloupcu`) mají `role="img"`, ale žádný název, takže čtečka řekne jen „obrázek“. Graf v čase (277) ho má. | Předat název (`aria-label`) jako u `sp-svg`. | MINOR → 1.19 | S | vysoká |
| 19 | riziko | app/statistiky.js:474–477, app/prehled.js:270 | `nacistStatistiky` nastaví `dataset.nacteno` ještě před `await` a chybu nechytá. Když `GetStatistiky` selže, zůstane navždy „Počítám statistiky…“ a znovu se načte až s celým Přehledem. | `try/catch`: při chybě `nacteno` smazat a ukázat hlášku s „Zkusit znovu“. | PATCH (po 1.0) | S | střední |
| 20 | zlepšení | app/statistiky.js:406, 446 | Prázdná sbírka nebo graf bez dat: karta grafu ukáže „Zatím žádná data.“ a pod tím návod „Klik na sloupec vybere rok, tažením…“, přestože není na co kliknout. Při prázdné sbírce je věta „Statistiky se ukážou…“ až pod celou prázdnou kostrou. | Bez dat návod neukazovat a při prázdné sbírce použít `htmlPrazdna` jako jinde. | PATCH (po 1.0) | S | vysoká |
| 21 | zlepšení | sablona.js:712; app/zkratky.js:10–52 | Nápověda Přehledu uvádí počet jen u Údržby, nabídka ho ale ukazuje i u Sháním CZ (prehled.js:62). Výčet Kontroly vynechává „vydání alba mimo roky časopisu“ (kontrola.go:99) a narození v budoucnosti nebo před rokem 1900. V přehledu zkratek (`?`) chybí Statistiky: ← → v grafu, Shift, Home/End, Esc zruší výběr. | Doplnit texty (v betě jsou zmrazené, nic z toho není chybně). | PATCH (po 1.0) | S | vysoká |
| 22 | zlepšení | style.css:451–455; main.go:39 | Okno jde zúžit na 280 px, ale pod 421 px hledání úplně zmizí (`display: none`) a nefunguje ani Ctrl+F (fokus na skrytý prvek neprojde). | Pod 421 px ikona lupy, která hledání rozbalí přes řádek okna. | MINOR → 1.19 (krok 1, úzké okno) | S–M | vysoká |
| 23 | zlepšení | style.css:2446–2449 × 122–127 | Zámek začíná na `inset: 36px`, řádek okna je ale vysoký 40 px, takže zámek překrývá spodní 4 px tlačítek okna (podbarvení při najetí je useknuté). | `inset: 40px 0 0 0`. | PATCH (po 1.0) | S | střední |
| 24 | zlepšení | style.css (zlomy 400, 420, 520, 560, 620, 640, 760, 860, 900, 1000, 1100 px) | 11 různých zlomů, z nichž některé leží těsně u sebe (400/420, 620/640, 860/900). Funguje to, ale chování se těžko předvídá. | Sjednotit na 400/620/900/1100 a zbytek odvodit. | PATCH (po 1.0) | M | vysoká |
| 25 | zlepšení | app/prehled.js:376 | Zastaralý komentář „Části v levém panelu“: části jsou od 0.99.1 v nabídce tlačítka Přehled. | Opravit komentář. | PATCH (po 1.0) | S | vysoká |

Bez nálezu: typografie (uvozovky „“, pomlčka –, trojtečka … v textech rozhraní, žádné `...` ani `" - "`),
tlumený text `--text-muted` (5,6–6,8 : 1), `--accent-text` (4,8–5,7 : 1), bílá na `--accent` (4,9 : 1),
obrys fokusu karet `--accent` (3,9 : 1, pro netextové prvky stačí 3 : 1), past fokusu v oknech
(klavesnice.js:40–50), Esc a šipky v nabídce (ui/nabidka.js), popisky polí v šabloně (kromě č. 3),
vodorovné přetečení (žádné ve všech testovaných pohledech a šířkách).

## 3. Opravy do bety (návrh 0.99.6)

**#1 Hledání na zamčené obrazovce:** style.css:2480–2484

```css
/* Zamčený program nenabízí v hlavičce nic kromě tlačítek okna */
#app.zamceno .logo > *,
#app.zamceno .nav-controls,
#app.zamceno .hlavni-lista > * {
    visibility: hidden;
}
```
`visibility: hidden` vyřadí pole i z pořadí Tabu. Hledání pod zámkem jinak nikde neběží (Ctrl+F je
hlídané v ulozeni.js:272). Ověřit: zamknout, Tab z pole hesla jde jen na tlačítka okna a zpět.

**#2 Popisky křížků:** sablona.js

- 620: `<button id="lbClose" class="lb-btn lb-zavrit" title="Zavřít (Esc)" aria-label="Zavřít">`
- 642: `<button type="button" class="ctecka-zavrit" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">`
- 659: `<button id="toastClose" class="close-btn" title="Zavřít" aria-label="Zavřít oznámení">`
- 28: `<button id="winCloseBtn" class="win-btn win-close" title="Zavřít" aria-label="Zavřít program">`

**#3 Popisky polí:** sablona.js

- 770: `<textarea id="inputClanekText" rows="10" aria-label="Text článku"></textarea>`
- 355: `<label id="bulkLinksLabel" for="inputBulkLinks">` (JS mění jen text popisku, `for` nevadí)
- 442: `<input type="password" id="inputLock" placeholder="Heslo" aria-label="Heslo" autocomplete="off" />`
- 775: `<textarea id="inputClanekSkeny" … aria-label="Skeny stran">`

**#4 a #5 Text nápovědy pod grafem:** app/statistiky.js:447

```js
? `Klik na sloupec vybere ${def.osa === 'mesic' ? 'měsíc' : 'rok'}, tažení myší období. Šipky ← → posouvají výběr, se Shiftem ho rozšíří; Esc výběr zruší. Výběr platí pro všechny grafy.${bezCisla ? ` Rok je rok prvního výskytu v časopise; ${pocetModelek(bezCisla)} bez čísla (jen online nebo bez vydání) v grafech v čase ${bezCisla >= 2 && bezCisla <= 4 ? 'nejsou' : 'není'}.` : ''}`
```
(1 modelka **není**, 2–4 modelky **nejsou**, 5 a víc modelek **není**.)

**#6 Fokus u vybraného řádku (volitelně):** style.css, za `.sp-pruh.vybrany` (5936)

```css
.sp-pruh:focus-visible,
.sp-modelka:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
}
```

Všech šest je jen v šabloně, CSS nebo jednom textu. Schéma ani export se nemění a testy Go nejsou dotčené.

## 4. Návrh rozdělení do vydání

| Vydání | Obsah | Poznámka |
|---|---|---|
| **0.99.6** (beta, před 6. 11.) | #1–#5, volitelně #6 | Jedna sada oprav „Opraveno: drobnosti rozhraní“; do changelogu dát i zámek. Kdyby se na Fedoře potvrdilo blikání podle #10, přidat 0.99.7 se zrušeným prolínáním. |
| **1.0.x** (PATCH po vydání, údržba) | #7, #8, #9, #23, #24, #25 | Úklid CSS v jednom kroku se snímky před a po (stejné pohledy jako tato revize). |
| **1.0.x** (PATCH po vydání, opravy) | #19, #20, #21, případně #10 a #11 | Stavy chyby a prázdna ve Statistikách, doplnění nápovědy a zkratek. |
| **1.19 Přístupnost** | krok 1 (přiblížení, úzké okno): #22, #15; krok 2 (popisky): #12, #13, #14, #16, #18; navíc #17 (omezení pohybu) | #17 se do ROADMAP hodí jako 3. krok tématu („Omezení pohybu“, S). Ověření Orcou podle „Hotovo, když“. |
