# Playboy Database – Roadmapa

Přehled vývoje od první verze k hotové aplikaci a dál k verzím 1.x.
Podrobnosti k dokončeným změnám jsou v `CHANGELOG.md`, pracovní úkoly a opravy v `PLAN.md`.

**Stav (10. 11. 2026): verze 1.48.0** – etapy 0–13, milník 1.0.0 a verze 1.1–1.48 jsou hotové: mezipaměť náhledů na
disku (1.6), online pictorialy a články (1.23), tematické sezóny a průvodce (1.16–1.18), obsah fotek s lokálními
modely CLIP + NudeNet + českým textovým modelem (1.24), odhad hodnocení, vizuální styly, automatické kolekce v
Galerii, Ideální modelka, Dnešní výběr (1.26), Postřehy ve Statistikách vč. neobvyklých roků a souvislostí
(1.27–1.29), hloubková optimalizace modelů, vykreslování a paměti (1.28.3–1.28.4), Mapa sbírky ve Statistikách (1.30.0)
Síň slávy jako část Modelek s hero záhlavím (1.31.0) a Podobné modelky s vysvětlením, vizuální
příbuzností z fotek a porovnáním (1.32.0) Stejné fotky v Údržbě s perceptuálními otisky (1.33.0) křivky s rozpětím a srovnání dvou období ve Statistikách (1.34.0) zásobník odkazů s rychlým oknem Nová modelka (1.35.0) chytré hledání s českými výrazy, čipy a našeptáváním (1.36.0) živé chytré výběry ⚡ (1.37.0) doplnění údajů z Wikidat, Wikipedie a Boobpedie s úplností čísla (1.38.0) propojení čísla a modelky – pás fotek čísla a kontext čísel v profilu (1.39.0) obousměrné odkazy [[…]] se „Zmiňováno v…“ (1.40.0; etapa C je hotová) režim čtení s prezentací čísla (1.41.0) zdraví sbírky s rozdílem před obnovením zálohy (1.42.0; etapa D je hotová) ročník podle Wikipedie (1.43.0), návrhy z webu ve frontě Údržby (1.44.0), otočené fotky s návrhem výřezu (1.45.0; etapa E je hotová) rok ve sbírce (1.46.0) kapesní katalog do telefonu (1.47.0) a upozornění na novou verzi (1.48.0; etapa F je hotová).

---

## Pravidlo verzování

Formát `MAJOR.MINOR.PATCH` (SemVer):

- **0.x.y – vývoj před 1.0:**
  - `0.1`–`0.79`: budování funkcí (etapy 1–11). MINOR = nová funkce, PATCH = oprava / drobné vylepšení.
  - `0.80.x` – **Alfa** (etapa 12, dokončeno): zmrazení schématu DB (úprava č. 11) a formátu exportu (verze 7), testy,
    stabilita, výkon, dokumentace. Žádné nové uživatelské funkce.
  - `0.90.x` – **Beta** (etapa 13, dokončeno): kandidát na vydání (RC), reálné používání na ostrých datech, opravy jen
    zjištěných chyb (`0.90.1`, `0.90.2`…).
- **1.0.0 – První stabilní vydání** (vydáno 22. 10. 2026).
- **1.x.y – Rozvoj po 1.0:**
  - **MINOR (`1.1.0`, `1.2.0`…)** = nové téma (skupina souvisejících funkcí z plánu níže).
  - **PATCH (`1.28.1`, `1.28.2`…)** = každý jednotlivý krok v rozpracovaném tématu i opravy chyb a optimalizace.
  - **MAJOR (`2.0.0`)** = velký milník programu. Kompatibilitu dat hlídá číslo úpravy schématu DB a verze exportu
    (`TestZmrazeniAlfy`), ne hlavní verze programu.

Verze se drží synchronně v: `verze.go`, `wails.json`, `frontend/package.json`, `frontend/package-lock.json`,
`frontend/package.json.md5` a `CHANGELOG.md`.

### Výjimka: profilová fotka (dokončeno v 0.91.0)

Jediná povolená změna v betě před 1.0.0 byla podpora ořezu profilové fotky z libovolné fotky modelky (`PortretZ` a
výřez `PortretX`/`PortretY`/`PortretS`). Schéma zůstalo na úpravě č. 11 a export na verzi 7.

---

## Přehled etap

| Etapa | Verze | Stav | Název | Hlavní přínos |
|---|---|---|---|---|
| 0 | 0.1–0.9 | ✅ Hotovo | Základ | Wails + SQLite, karty modelek, detail, fotky z Google Drive |
| 1 | 0.10–0.19 | ✅ Hotovo | Struktura dat a edice | Alba jako záznamy, US/CZ edice, speciály, import ze souboru |
| 2 | 0.20–0.29 | ✅ Hotovo | Čísla časopisů a prohlížeč | Správa čísel, obálky, PMOY, vylepšený lightbox |
| 3 | 0.30–0.39 | ✅ Hotovo | Statistiky, údržba a vzhled | Grafy, kontrola dat, zálohy, redesign, česká sbírka |
| 4 | 0.40–0.49 | ✅ Hotovo | Prohlížení, výběry a tisk | Filtry, kolekce fotek, prezentace, porovnání, tisk |
| 5 | 0.50–0.55 | ✅ Hotovo | Mapa sbírky a chytrá kontrola | Mřížka ročníků, výročí, duplicity, opravy dat, nápověda |
| 6 | 0.56–0.58 | ✅ Hotovo | Propojení osobností | Fotografové, autoři textů, osobnosti z rozhovorů a článků |
| 7 | 0.59–0.62 | ✅ Hotovo | Životní příběh a proměny | Časová osa modelky, proměny v čase, mapa původu, sousední čísla |
| 8 | 0.63–0.65 | ✅ Hotovo | Pohodlí při každodenní práci | Hromadné úpravy, klávesová paleta `Ctrl+K`, připnuté položky |
| 9 | 0.66–0.68 | ✅ Hotovo | Soukromí a přenositelnost | Zámek aplikace, přenosný balíček, kontrola odkazů na Drive |
| 10 | 0.69–0.71 | ✅ Hotovo | Vyladění rozhraní | Sjednocení typografie, prázdné stavy, plynulé přechody |
| 11 | 0.72–0.74 | ✅ Hotovo | Chytrá kontrola dat (ML/statistika) | Odhad chybějících údajů, detekce anomálií, skóre kvality profilu |
| 12 | 0.80.x | ✅ Hotovo | Alfa – stabilizace a testy | Zmrazení DB schématu, unit/integrační testy, výkon pro 5 000+ modelek |
| 13 | 0.90–0.91 | ✅ Hotovo | Beta – kandidát na vydání | Ověření v reálném provozu, profilový ořez z fotky (0.91.0) |
| **1.0** | **1.0.0** | **✅ Hotovo** | **První stabilní vydání** | Spolehlivá, otestovaná a zdokumentovaná verze |
| **1.6–1.29** | **1.6–1.29** | **✅ Hotovo** | **Náhledy, Obsah fotek, Postřehy, Dnešní výběr** | Disková cache náhledů, CLIP + NudeNet + CZ textový model, odhady srdíček a tagů, styly, kolekce, Ideální modelka, Dnešní výběr, Postřehy 1–5 |
| **Etapa A** | **1.30–1.34** | **✅ Hotovo** | **Prohloubení práce s modely, fotkami a Statistikami** | Mapa sbírky (PCA / autoenkodér), Síň slávy v Modelkách, Podobné modelky s vysvětlením, Stejné a podobné fotky, Křivky a srovnání období |
| **Etapa B** | **1.35–1.37** | **✅ Hotovo** | **Rychlé plnění sbírky a chytré hledání** | Rychlé přidávání a zásobník fotek, Chytré hledání se zápisem a našeptáváním, Chytré výběry (Průvodce přidáním čísla odložen do etapy J) |
| **Etapa C** | **1.38–1.40** | ✅ Hotovo | **Obohacení obsahu** | Úplnost sbírky a Wikidata, Propojení čísla a modelky, Bohatý text a obousměrné odkazy |
| **Etapa D** | **1.41–1.42** | ✅ Hotovo | **Prohlížení a údržba** | Režim čtení a prezentace čísla, Zdraví sbírky a zálohy (tiskové sestavy přesunuty do etapy I) |
| **Etapa E** | **1.43–1.45** | ✅ Hotovo | **Kvalita dat ve velkém** | Ročník podle Wikipedie, Návrhy z webu ve frontě Údržby, Otočené fotky a návrh výřezu |
| **Etapa F** | **1.46–1.48** | ✅ Hotovo | **Přehledy a pohodlí** | Rok ve sbírce, Kapesní katalog offline, Upozornění na novou verzi |
| **Etapa G** | **1.49–1.51** | 📋 Plán | **Vzhled a čitelnost** | Přiblížení, hustota a karty, Světlý motiv a kontrast, Klid a vlastní Přehled |
| **Etapa H** | **1.52–1.55** | 📋 Plán | **Návrat k hotovým funkcím** | Údržba jako jedna fronta, Hledání a výběry 2, Statistiky a vkus 2, Prohlížení a časopis 2 |
| **Etapa I** | **1.56–1.59** | 📋 Plán | **Sbírka výtisků** | Evidence výtisků české edice, Výdaje a hodnota sbírky, Rozšířené tiskové sestavy, Burza a výměny |
| **Etapa J** | **1.60–1.63** | ⏸ Odloženo | **Kvíz, průvodce číslem a Google Disk** | Kvíz „Poznej playmate“, Průvodce přidáním celého čísla, Google Disk v aplikaci, Vkládání z Disku |

---

## Dokončeno v řadě 1.0–1.48 ✅

- **1.0.0 – První stabilní vydání** (22. 10. 2026): dokončení alfy (0.80.x) a bety (0.90.x–0.91.1).
- **1.6 – Rychlé načítání fotek (mezipaměť náhledů)** (`internal/nahledy`): lokální disková mezipaměť (`w400`, `w1600`, `w3840`), rozpočet místa (výchozí 2 GB, LRU uvolňování), stahování na pozadí s ohledem na aktivitu okna, zotavení při výpadku sítě / HTTP 429, záložní tvary adres Google Drive.
- **1.16–1.18 – Tematické sezóny, Průvodce sezónou a Fotka dne v Přehledu**: tematické okruhy v Přehledu, průvodce procházením sezóny, Fotka dne se střídáním a kontextem.
- **1.23 – Online pictorialy a články** (schéma č. 12, export 8): podpora `online` výskytů, editační formulář, filtry v Galerii, Statistikách, Časopisech a Osobnostech.
- **1.24–1.25 – Obsah fotek, Vzhled na fotkách, Vizuální styly, Automatické kolekce a Ideální modelka** (`internal/obsah`, `obsah_fotek.go`, `galerie_kolekce.go`):
  - Obrazový model CLIP ViT-B/32 (ONNX Runtime) + detektor partií NudeNet 320n YOLOv8 + český int8 jazykový model DistilBERT → CLIP.
  - Automatické návrhy tagů fotek a učení z ručně otagovaných fotek (hřebenová regrese s křížovou validací a Choleskyho rozkladem).
  - Odhad hodnocení (srdíček) neohodnocených fotek z obsahu a partií, navrhování kandidátů na 5♥ v Galerii a v Průvodci hodnocením.
  - Odhad vzhledu na fotkách (barva vlasů, délka vlasů, opálení) a doplnění návrhů do Chytré kontroly.
  - K-means++ shlukování vizuálních stylů sbírky a Automatické kolekce v Galerii fotek.
  - Ideální modelka podle vkusu uživatele v Síni slávy a blízkost modelek k ideálu.
- **1.26 – Dnešní výběr v Přehledu**: chytrý denní výběr v Přehledu s využitím obsahu fotek, hodnocení a výročí.
- **1.27–1.29 – Postřehy ve Statistikách (kroky 1–5)** (`frontend/src/lib/statistika.js`, `frontend/src/lib/postrehy.js`, `frontend/src/app/statistiky.js`):
  - Statistické jádro (Kendallovo $\tau_b$, Cochranův–Armitageův test, Theilův–Senův sklon, Wilsonův interval, Mannův–Whitneyův test, Fisherův přesný test, Spearmanova korelace $\rho$, Benjaminiho–Hochbergova oprava).
  - Krok 1: Trendy v čase pod grafy v detailu.
  - Krok 2: Zlomy v časových řadách (binární dělení s opravou na vícenásobné testování a svislou čárou v grafu).
  - Krok 3: Rozdíly výběru oproti celé sbírce s předpočtenými pořadími a přímou standardizací podle desetiletí.
  - Krok 4: Přehled postřehů nahoře ve Statistikách (hero pás s 5 nejsilnějšími postřehy a pruh aktivního výběru).
  - Krok 5 (1.29.0): Neobvyklé roky vybočující ze svého úseku a průkazné souvislosti mezi vlastnostmi modelek.
- **1.28.3–1.28.4 – Hloubková optimalizace výkonu, paměti a modelů**:
  - Jedno dekódování JPEG na fotku pro všechny 3 výpočty (CLIP, NudeNet, Vzhled), předalokované škálovací buffery a LUT tabulky bez dělení v pixelech.
  - Proudové čtení `.safetensors` bez 400MB špičky v RAM, automatické uvolnění jazykového modelu po 5 minutách nečinnosti, `sync.Pool` pracovních matic transformeru, bezalokační UTF-8 WordPiece tokenizace, 4× rozbalené skalární součiny a Choleskyho rozklad.
  - Inkrementální zápis `vektory.bin`, hodnotové mapy `[18]uint8` bez pointerů pro GC, streamování náhledů přes `http.ServeContent`, připravené SQL dotazy (`sql.Stmt`).
  - Odstranění $O(N^2)$ přepojování `IntersectionObserver`u, `w400` náhledy v rozmazaném pozadí místo 4K textur, úklid časovačů a pozorovatelů.

- **1.30 – Mapa sbírky ve Statistikách** (`frontend/src/lib/mapa-sbirky.js`): PCA s pevnou orientací os, Procrustovo zarovnání, barevné režimy, laso jako výběr pro ostatní grafy. Zbývá z plánu: autoenkodér, `<canvas>` nad 2 000 bodů, míra posunu a „Přepočítat od začátku“.
- **1.31 – Síň slávy v Modelkách s hero záhlavím a první Podobné modelky**: Síň slávy jako část Modelek s herem a lepivým pásem pohledů, pás karet součástí hera ve Statistikách i Síni, Podobné modelky v profilu s důvody a „Na mapě →“, legenda Mapy sbírky jako rychlý výběr.
- **1.32 – Podobné modelky s vysvětlením a vizuální příbuzností** (`podobne_modelky.go`, `frontend/src/lib/mapa-sbirky.js`): společný fotograf v důvodech, přepínač Údaje / Na fotkách (kosinová podobnost středů vektorů obsahu fotek, aspoň 3 fotky s vektorem), ⚔ Porovnat s touto do Hodnocení › Porovnat.
- **1.33 – Stejné a podobné fotky v Údržbě** (`otisky.go`, `stejne_fotky.go`, `frontend/src/app/udrzba-stejne.js`): dHash a pHash z náhledů w400 na pozadí (`otisky.bin` v mezipaměti), skupiny podle otisků v celé sbírce a podle vektoru obsahu (≥ 0,985) u fotek téže modelky, režim Údržby Stejné fotky se srovnáním vedle sebe, sloučením (kopie se odebere nebo vymění soubor, srdíčka a tagy přejdou) a výjimkami „V pořádku“, obojí s Vrátit; upozornění po vložení fotek.
- **1.34 – Křivky v čase a srovnání dvou období** (`frontend/src/lib/krivky.js`, `lib/postrehy.js` `porovnatObdobi`, `app/statistiky.js`): přepínač Sloupce / Křivka a rozpětí (klouzavý medián s pásmem Q1–Q3, u podílů Wilsonův 95% interval), graf Porovnat období s předvolbami desetiletí i vlastními roky, průkaznými rozdíly (Mann–Whitney, Fisher, BH) a tabulkou všech údajů.
- **1.35 – Rychlé přidávání a zásobník fotek** (`rychle_pridani.go`, `frontend/src/app/zasobnik.js`, `app/kontrola-odkazu.js`, `lib/rychle-pridani.js`): zásobník odkazů nad alby profilu (Ctrl+V, přetažení, Ctrl+Enter, pamatuje se pro každou modelku), kontrola fotek, které už ve sbírce jsou, před vložením (zásobník, okno alba, rychlé okno), rychlé okno Ctrl+Shift+N s prvním výskytem, narozením nebo věkem, odhadem národnosti a fotkami, „Uložit a další“.
- **1.36 – Chytré hledání se zápisem a našeptáváním** (`frontend/src/lib/hledani-dotaz.js`, `app/hledani-cipy.js`, `internal/hledani`, `galerie_fotek.go`): české výrazy (`blond`, `výška > 175`, `pas <= 60`, `90. léta`, `česká edice`, `pmoy`, `4*+`, `bez fotek`) se převedou na příkazy ve všech pohledech, čipy s × pod polem, chytré výrazy v našeptávači s `Tab`, nové příkazy `pas: hrudnik: boky: bmi: whr: vek: fotek:`, příkazy i v Galerii fotek; zásobník odkazů přesunut na konec profilu.
- **1.37 – Chytré výběry fotek a modelek** (`chytre_vybery.go`, `frontend/src/app/chytre-vybery.js`): živé uložené podmínky (hledání, filtr Modelek, filtry, kolekce a řazení Galerie fotek) s počty a náhledy, čipy ⚡ v Modelkách, Všech fotkách a panelu Kolekce, karta v Přehledu, úprava a převzetí podmínek, zmrazení do výběru fotek nebo tagu modelek; v nastaveni (`chytre_vybery`) a v nepovinné části `nastaveni` exportu – schéma (č. 16) ani verze exportu (13) se nemění; Uložené výběry Galerie převedeny.
- **1.38 – Úplnost sbírky a doplnění z Wikidat, Wikipedie a Boobpedie** (`zdroje_udaju.go`, `frontend/src/app/zdroje-udaju.js`, `app/vydani.js`): tlačítko Z webu v profilu – údaje ze tří zdrojů (ověření osoby podle povolání Playmate, roku narození a měsíce centerfoldu), převod do podoby sbírky (česky, cm, kg, evropská velikost prsou), okno jen s odlišnými údaji a volbou zdroje, zápis jen zvoleného s odkazem na zdroj; Úplnost v detailu čísla s rychlým doplněním a Playmate měsíce podle Wikipedie (chybějící přes rychlé okno). Dotazy jen na kliknutí, 1/s na server, mezipaměť hodina.
- **1.39 – Propojení čísla a modelky při čtení** (`frontend/src/app/kontext-cisla.js`, `lib/kontext-cisla.js`, `app/vydani.js`): pás všech fotek čísla v detailu čísla s prohlížečem jen pro číslo a Promítat; v profilu náhledy obálek u štítků čísel a bublina s obálkou, Playmate měsíce, dalšími modelkami v čísle a předchozím/následujícím číslem téže edice.
- **1.40 – Obousměrné odkazy `[[…]]`** (`zminky.go`, `frontend/src/lib/odkazy.js`, `app/wiki-odkazy.js`, `ui/editor-textu-cm.js`): `[[Jméno]]`, `[[06/1995]]`, `[[Fotograf]]` i `[[cíl|popisek]]` v poznámkách, textech alb, článcích a poznámkách čísel; našeptávač po `[[` v editoru, zvýraznění v editoru, klikací odkaz s vizitkou, sekce „Zmiňováno v…“ v profilu i v detailu čísla. Lišta editoru (Ctrl+B/I, nadpis, odrážky, citace) a Náhled už existovaly.
- **1.41 – Režim čtení a prezentace čísla** (`frontend/src/lib/casopis.js`, `app/casopis.js`): Jako časopis v detailu čísla a Časopis v profilu – přes celou obrazovku obálka → Playmate měsíce → další modelky → články → fotky (profil: úvod → články → alba), redakční dvoustrany s patkovým písmem; šipky, mezerník, Home/End, klik, Esc; prezentace 3 / 5 / 10 s s prolínáním a Ken Burns k výřezu portrétu, lišta mizí v klidu.
- **1.42 – Zdraví sbírky a porovnání se zálohou** (`zdravi_sbirky.go`, `frontend/src/app/zdravi.js`, `app/sprava.js`): karta Zdraví sbírky v Údržbě › Souhrn (zálohy, export s připomínkou po 14 dnech a ≥ 20 změnách, ověření souborů, mezipaměti a obsah fotek, úkoly); před obnovením zálohy rozdíl nanečisto po tabulkách (přibude / zmizí / změní se s příklady a změněnými sloupci). Datum posledního exportu v nastavení, schéma beze změny.
- **1.43 – Ročník podle Wikipedie** (`rocnik_wikipedie.go`, `frontend/src/app/rocnik-wiki.js`): Playmate měsíců (i víc v jednom měsíci) a Playmate roku proti sbírce se stavy shoda / chybí / překlep / jiné jméno / jiný měsíc / bez centerfoldu; chybějící do fronty rychlého okna Nová modelka, převzetí jména z Wikipedie s potvrzením. Z Kalendáře, stránky ročníku a americké mapy sbírky.
- **1.44 – Návrhy z webu ve frontě Údržby** (`pruchod_webem.go`, `frontend/src/app/udrzba-web.js`): režim Údržby Z webu – průchod sbírkou na pozadí (1 dotaz/s na server, přerušení, pokračování po restartu, stav v `nastaveni`), fronta rozdílů se zdrojem a odkazem, přijetí po jednom / po modelce / po údaji či zdroji (jen jednoznačné, se zálohou), odmítnuté se pamatují.
- **1.45 – Otočené fotky a návrh výřezu** (`otocene_fotky.go`, `internal/obsah/otoceni.go`, `frontend/src/app/udrzba-fotky.js`): režim Údržby Otočené a výřezy – kontrola otočení na pozadí z vektorů CLIP otočených náhledů proti středu sbírky (`obsah/otoceni.json`, přerušení a pokračování), otočení jedním klikem nebo V pořádku, s Vrátit; návrh výřezu titulní fotky 3 : 4 z detekce postavy NudeNet v okně výřezu (Navrhnout) i hromadně v Údržbě. Práh otočení se doladí v 1.45.x po ověření na vzorku.
- **1.46 – Rok ve sbírce** (`rok_ve_sbirce.go`, `frontend/src/lib/rok-ve-sbirce.js`, `app/rok-ve-sbirce.js`): výroční přehled z hera Statistik – přibylé modelky, alba, fotky a čísla se srovnáním s loňskem, měsíce, dny práce a nejdelší série, nejlepší nové fotky a modelky, dokončené ročníky a vyhlášené sezóny; Jako časopis v režimu čtení a Tisk / PDF.
- **1.47 – Kapesní katalog offline** (`kapesni_katalog.go`, `frontend/src/lib/kapesni-katalog.js`, `app/kapesni-katalog.js`): ⋯ › Kapesní katalog do telefonu – složka s jedním `index.html` a náhledy obálek w400 z mezipaměti; čísla s Playmate a stavem výtisku, hledání bez diakritiky a filtr mám / sháním / chybí v prohlížeči telefonu bez sítě; rozsah celá sbírka / česká edice / sháněná čísla s odhadem velikosti.
- **1.48 – Upozornění na novou verzi** (`aktualizace.go`, `frontend/src/app/nova-verze.js`, `instalovat.sh`): cesta ke klonu předaná při sestavení, jednou denně `git fetch` bez hesla s limitem, verze a CHANGELOG vzdálené větve, oznámení s Co je nového a příkazem k aktualizaci; ⋯ › Zkontrolovat novou verzi a vypnutí denní kontroly.
---

## Plán dalšího rozvoje (1.30–1.63)

Pořadí etap navazuje na to, co je v aplikaci čerstvě vybudované (vektory obsahu fotek, statistické jádro a postřehy), a postupně přechází ke zrychlení každodenního plnění sbírky, chytrému hledání a propojení s Google Diskem a Wikidaty.

---

### Etapa A – Prohloubení práce s modely, fotkami a Statistikami (1.30–1.34) ✅

Tato etapa přímo zhodnocuje připravené statistické jádro (`statistika.js`, `postrehy.js`), chytré učení (`kontrola_uceni.go`) a obrazové vektory (`internal/obsah`). Nevyžaduje žádnou změnu schématu databáze ani formátu exportu.

#### 1.30 – Mapa sbírky ve Statistikách (PCA + lehký autoenkodér)

**Cíl:** nová karta ve Statistikách „Mapa sbírky“, kde je každá modelka bod v rovině a blízké body znamenají podobné modelky; laso na mapě funguje jako interaktivní výběr pro ostatní grafy. Návrh v [NAVRH-NEURONOVA-SIT.md](docs/NAVRH-NEURONOVA-SIT.md). Bez změny schématu DB i exportu.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Mapa PCA | `mapa.go`: příznaky (z-skóre postavy z `kontrola_uceni.go`, one-hot vlasů, očí, národnosti, kategorie, období, fotografové, masky chybějících), PCA s pevnou orientací os, `GetMapaSbirky`; graf „Mapa sbírky“ ve Statistikách s barvou podle údaje, bublinou a klikem na profil | M |
| 2 | Lehký autoenkodér v čistém Go | `sit.go` (Adam, L2, early stopping, pevné semínko), sítě s 2-D a 8-D kódem, ztráta jen z vyplněných údajů, učení na pozadí, váhy (~50 kB) v `nastaveni`; použije se jen tehdy, když zachová sousedy o $\ge 0{,}05$ lépe než PCA | M–L |
| 3 | Stabilita a zarovnání | Nové modelky kodérem hned, teplý start při +5 % modelek, zarovnání Procrustovou transformací, míra posunu pod mapou, tlačítko „Přepočítat od začátku“ | M |
| 4 | Laso, podobnost a druhý názor | Výběr lasem na mapě (zúží grafy a seznam stejně jako filtr), legenda jako rychlý výběr, „Na mapě →“ v profilu, vykreslování přes `<canvas>` nad 2 000 bodů; 8-D kód jako doplněk Gowerovy podobnosti a druhý názor pro `ok-neobvykle` | M |

**Hotovo, když:** mapa se ukáže do 100 ms, laso plynule filtruje Statistiky, po přidání 30 modelek se staré body posunou o < 3 % a stejná data dají vždy stejnou mapu.

#### 1.31 – Síň slávy v Modelkách s hero záhlavím a první Podobné modelky ✅ (9. 11. 2026)

Mimo původní plán: Síň slávy se přesunula mezi části Modelek (Profily · Galerie · Statistiky · Síň slávy) a dostala hero
záhlaví jako Profily a Statistiky; pás karet je ve Statistikách i v Síni součástí hera. Z 1.30 přibyla legenda Mapy sbírky
jako rychlý výběr, „Na mapě →“ v profilu a 8-D kód jako doplněk Gowerovy podobnosti, z 1.32 blok Podobné modelky
v profilu s důvody podobnosti.

#### 1.32 – Podobné modelky s vysvětlením a vizuální příbuzností ✅ (9. 11. 2026)

**Cíl:** rozšířit sekci „Podobné modelky“ v detailu profilu o lidsky čitelné důvody podobnosti a o volitelné přimíchání vizuální podobnosti z fotek (průměrný CLIP vektor a vzhled modelky z `internal/obsah`).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Vysvětlení podobnosti | U každé podobné modelky 2–3 nejvýraznější společné rysy (např. `170 cm · 89-60-89 · blond · 90. léta · fotograf S. Wayda`) | S |
| 2 | Režim „Podobné postavou / Podobné na fotkách“ | Přepínač v detailu modelky: buď čistá podobnost údajů (Gower + 8-D kód z 1.30), nebo kombinovaná s kosinovou podobností průměrného vektoru fotek modelky | S–M |
| 3 | „Porovnat s touto“ | Kliknutí u podobné modelky rovnou otevře boční porovnání obou modelek vedle sebe | S |

**Hotovo, když:** každá karta podobné modelky jasně říká, v čem jsou si blízké, a při spočítaném obsahu fotek lze hledat i vizuálně podobné modelky.

#### 1.33 – Stejné a podobné fotky v Údržbě (perceptuální otisky + CLIP) ✅ (9. 11. 2026)

**Cíl:** najít v Údržbě stejnou fotku nahranou na Google Disk víckrát (s jiným ID) i téměř shodné záběry ze stejného focení. Využije kombinaci rychlého obrazového otisku (dHash + pHash z náhledů `w400`) pro přesné a oříznuté kopie a existujících CLIP vektorů (`internal/obsah`) pro vizuálně téměř totožné záběry. Bez změny schématu i exportu (`~/.cache/playboy-app/otisky.bin`).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Perceptuální otisky `otisky.go` | 64bitový dHash + pHash v čistém Go počítaný při průchodu náhledů (nebo dávkově na pozadí s respektem k `pockatNaKlid`), binární uložení v cache | S–M |
| 2 | Skupiny duplicit v Údržbě | Filtr v Údržbě „Stejné fotky“: seskupení podle Hammingovy vzdálenosti otisků a kosinové podobnosti CLIP vektorů ($\ge 0{,}985$), porovnání vedle sebe (rozlišení, srdíčka, tagy, typ), „Odebrat duplicitní“ s „Vrátit“, „V pořádku (nejsou stejné)“ v `nastaveni` | M |
| 3 | Kontrola při vkládání | Při přidávání nových fotek okamžité upozornění, pokud otisk odpovídá již uložené fotce u modelky nebo v čísle | S |

**Hotovo, když:** přeuložená nebo mírně oříznutá kopie fotky se v Údržbě spáruje do skupiny, porovnání umožní jedním klikem nechat kvalitnější kus a potvrzené výjimky se znovu nehlásí.

#### 1.34 – Křivky v čase a srovnání dvou období ve Statistikách ✅ (9. 11. 2026)

**Cíl:** na grafech v čase nabídnout hladkou křivku trendu (LOESS / klouzavý medián s pásmem kvartilů Q1–Q3) a umožnit přímé srovnání dvou libovolných období (např. 70. léta vs 90. léta) vedle sebe s využitím testů z `postrehy.js`.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Pásmo Q1–Q3 a hladká křivka | Přepínač nad grafem v čase „Sloupce / Křivka a rozpětí“: medián vyhlazený v okně a stínované pásmo 25.–75. percentilu (pro podíly Wilsonův 95% interval spolehlivosti) | M |
| 2 | Srovnání období A vs B | Režim „Porovnat období“ ve Statistikách: výběr dvou rozsahů let (nebo předvoleb desetiletí) a automatický výpis průkazných rozdílů mezi obdobími A a B (Mann–Whitney, Fisher, Benjamini–Hochberg) | M |

**Hotovo, když:** uživatel jedním klikem přepne sloupcový graf na křivku s kvartilovým pásmem a může porovnat libovolná dvě desetiletí se statisticky podloženým shrnutím rozdílů.

---

### Etapa B – Rychlé plnění sbírky a chytré hledání (1.35–1.37) ✅

Cílem etapy je zkrátit čas potřebný k zadání nového čísla, nové modelky a nových fotek na minimum a zpřístupnit chytré dotazy napříč celou aplikací.

#### 1.35 – Rychlé přidávání a zásobník fotek ✅ (9. 11. 2026)

**Cíl:** zadat novou modelku s fotkami a výskytem v jednom okně na pár kláves a mít v detailu modelky trvalý „zásobník“ na průběžné odkládání odkazů na fotky.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Zásobník odkazů v profilu | Textové pole nad fotkami s odpočtem platných a duplicitních odkazů, přetažení textu z prohlížeče, `Ctrl+Enter` přidá vše, zásobník drží rozepsané odkazy při přepnutí mezi modelkami | S–M |
| 2 | Duplicity před vložením | Před uložením dávky výpis již existujících fotek (s odkazem, kde už jsou) a vložení jen nových | S |
| 3 | Jednotné rychlé okno `Ctrl+Shift+N` | Jméno + první výskyt + odkazy na fotky + „Uložit a další“, odhad země a národnosti z čísla, předvyplnění data narození nebo věku při prvním výskytu | M |

**Hotovo, když:** nová modelka s číslem a 10 fotkami je uložená bez přepínání pohledů a rozpracovaný zásobník odkazů se při překliknutí jinam neztratí.

#### 1.36 – Chytré hledání se zápisem a našeptáváním ✅ (9. 11. 2026)

**Cíl:** rozšířit vyhledávací pole v Galerii modelek, Galerii fotek a v `Ctrl+K` o přirozené české výrazy s čísly, obdobími, hodnocením a vlastnostmi (`výška > 175`, `pas <= 60`, `90. léta`, `pmoy`, `česká edice`, `5*`, `bez fotek`), s rozkladem na odznaky pod polem a našeptáváním.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Slovník a rozklad dotazu (`hledani-dotaz.js`) | Čistá bezstavová funkce rozkládající text na strukturované podmínky (rozsahy mír, věku, BMI, WHR, desetiletí, roky, edice, kategorie, barvy vlasů/očí, příznaky, srdíčka) + zbytek pro textové hledání | M |
| 2 | Odznaky (čipy) pod polem | Zobrazení rozpoznaných podmínek jako klikacích čipů (`Výška > 175 cm ×`, `1990–1999 ×`), klik na `×` odebere odpovídající část z textu | S–M |
| 3 | Našeptávání a nápověda | Nabídka vlastností, hodnot a příkladů při psaní (šipky, `Tab`, `Esc`), propojení s paletou `Ctrl+K` | S–M |

**Hotovo, když:** dotaz `blond výška > 175 90. léta 4*+` okamžitě vyfiltruje modelky, ukáže 4 srozumitelné čipy pod polem a každou podmínku lze jedním klikem odebrat.

#### 1.37 – Chytré výběry fotek a modelek ✅ (9. 11. 2026)

**Cíl:** uložit libovolný filtr nebo chytrý dotaz (včetně sémantického hledání podle obsahu fotek a tagů) jako živý „Chytrý výběr“ s ikonou ⚡, který se automaticky aktualizuje s každou novou modelkou či fotkou.
*(Pozn.: Lze uložit do tabulky `nastaveni` pod klíčem `chytre_vybery` a při exportu do pole v `nastaveni`, takže nevyžaduje změnu schématu DB č. 12 ani formátu exportu č. 8!)*

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Uložení chytrého výběru | V Galerii fotek i v Galerii modelek tlačítko „Uložit filtr jako chytrý výběr…“ (název, popis, parametry filtru / dotazu) uložené v `nastaveni` | S–M |
| 2 | Vyhodnocení a zobrazení | Čip s ⚡ mezi výběry v Galerii fotek a v Přehledu, počet odpovídajících položek, možnost upravit podmínky nebo „Zmrazit do běžného výběru“ | M |

**Hotovo, když:** nová fotka nebo modelka splňující podmínky se v chytrém výběru objeví automaticky, export/import chytré výběry zachová a schéma DB zůstává na úpravě č. 12.

---

### Etapa C – Obohacení obsahu (1.38–1.40)

#### 1.38 – Úplnost sbírky a doplnění z Wikidat, Wikipedie a Boobpedie (na vyžádání) ✅ (9. 11. 2026)

**Cíl:** v detailu čísla ukázat „Co ještě chybí k úplnosti“ a v detailu modelky nabídnout tlačítko „Doplnit z Wikidat…“, které najde chybějící údaje (datum/místo narození, výšku, barvu vlasů/očí) a předloží je uživateli k potvrzení položku po položce.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Kontrolní seznam v detailu čísla | Kompaktní přehled v detailu čísla (obálka, Playmate měsíce, počet modelek, fotky, rozhovor) s rychlými odkazy na doplnění | S |
| 2 | Dotaz na Wikidata v Go (`wikidata.go`) | SPARQL / API dotaz s mezipamětí a limitem 1 dotaz/s, porovnání se stávajícími údaji modelky | M |
| 3 | Potvrzovací okno rozdílů | Tabulka „V databázi → Na Wikidatech“ se zaškrtávátky jednotlivých polí; prázdná pole předzaškrtnutá, vyplněná nezaškrtnutá; nic se nikdy nezapíše bez potvrzení | S–M |

**Hotovo, když:** kliknutí na „Doplnit z Wikidat…“ u modelky nabídne nalezené chybějící údaje s odkazem na zdroj a uloží jen zaškrtnuté položky.

#### 1.39 – Propojení čísla a modelky při čtení ✅ (9. 11. 2026)

**Cíl:** propojit detail čísla a profil modelky tak, aby z čísla byly přímo vidět fotky z toho vydání a z profilu modelky šlo procházet její čísla s obálkami a sousedními vydáními.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Pás fotek čísla a rychlé otevření | V detailu čísla horizontální pás fotek přiřazených k tomuto vydání, klik otevře prohlížeč fotek jen pro toto číslo | S–M |
| 2 | Obálky a sousední čísla v profilu | U každého výskytu v profilu modelky malý náhled obálky s bublinou (Playmate měsíce, další modelky v čísle) a přechodem na předchozí/následující číslo | S–M |

**Hotovo, když:** z detailu čísla lze rovnou prohlížet všechny fotky vydání a v profilu modelky jsou u výskytů živé obálky s kontextem čísla.

#### 1.40 – Bohatý text a obousměrné odkazy (`[[Jméno]]`, `[[MM/RRRR]]`) ✅ (9. 11. 2026)

**Cíl:** pohodlná lišta pro formátování poznámek a životopisů s živým náhledem a obousměrné propojování záznamů pomocí `[[Jméno modelky]]`, `[[06/1995]]` nebo `[[Fotograf]]` s přehledem „Zmiňována v…“.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Lišta editoru a náhled | Tučné (`Ctrl+B`), kurzíva (`Ctrl+I`), nadpis, odrážky, citace, přepínač Psát / Náhled | S |
| 2 | Odkazy `[[…]]` s našeptáváním | Při napsání `[[` nabídka modelek, čísel a osobností; v náhledu a čtení klikací odkaz s vizitkou při najetí myší | M |
| 3 | Sekce „Zmiňována v…“ | Automatický přehled všech čísel, článků a jiných profilů, které na danou modelku nebo číslo v textu odkazují | S–M |

**Hotovo, když:** odkaz `[[06/1995]]` v poznámce u modelky vede na číslo 06/1995 a v detailu čísla 06/1995 se tato modelka objeví v „Zmiňováno v…“.

---

### Etapa D – Prohlížení a údržba (1.41–1.42) ✅

#### 1.41 – Režim čtení a prezentace čísla ✅ (9. 11. 2026)

**Cíl:** prohlédnout si celé číslo nebo profil modelky jako čistou redakční dvoustranu v celoobrazovkovém režimu (obálka → Playmate měsíce → další modelky → rozhovor a články → fotky) s volitelným automatickým posunem.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Režim čtení čísla a profilu | Tlačítko „Prohlédnout jako časopis“ v detailu čísla a profilu, čistá typografie bez ovládacích prvků, ovládání šipkami, mezerníkem a `Esc` | M |
| 2 | Automatická prezentace | Volitelný časovač (3 / 5 / 10 s), jemný prolínací přechod a Ken Burns efekt s respektem k výřezu portrétu | S–M |

**Hotovo, když:** celé číslo lze projít od obálky po poslední fotku pouze mezerníkem nebo nechat běžet jako prezentaci.

#### 1.42 – Zdraví sbírky, připomínka zálohy a porovnání se zálohou ✅ (9. 11. 2026)

**Cíl:** v Údržbě ukázat souhrnnou kartu „Zdraví sbírky“, upozornit na zastaralou zálohu a před obnovením ze zálohy přesně vypsat, co by se změnilo (rozdíl oproti současné databázi).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Karta Zdraví sbírky a připomínka zálohy | Souhrn v Údržbě (poslední záloha, poslední kontrola odkazů, velikost a stav cache náhledů a modelů, počet nálezů kontroly); jemné upozornění, pokud záloha je starší než 14 dní a přibylo $\ge 20$ změn | S–M |
| 2 | Náhled rozdílů před obnovením zálohy | Před obnovením ze souboru výpis změn (kolik modelek, čísel a fotek přibude, ubude nebo se změní) bez přepsání databáze nanečisto | M |

**Hotovo, když:** uživatel před obnovením zálohy přesně vidí seznam rozdílů a v Údržbě má na jednom místě přehled o technickém stavu celé sbírky.

---

### Etapa E – Kvalita dat ve velkém (1.43–1.45) ✅

Navazuje na doplnění z webu (1.38) a obsah fotek (1.24): místo jedné modelky celý ročník nebo celá sbírka – vždy
na kliknutí, na pozadí s možností přerušit a s potvrzením každého údaje (Nedělat: nic se nezapíše samo).

#### 1.43 – Ročník podle Wikipedie ✅ (9. 11. 2026)

**Cíl:** porovnat celý ročník (a Playmate roku) se seznamem na Wikipedii a dohnat, co ve sbírce chybí nebo nesedí.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Porovnání ročníku | V Kalendáři a Mapě sbírky „Ročník podle Wikipedie…“: 12 měsíců + PMOY, u každého shoda / ve sbírce chybí / jiné jméno / jiný měsíc, s odkazem na zdroj | S–M |
| 2 | Hromadné dohnání | Chybějící Playmate do fronty rychlého okna Nová modelka (jméno a číslo předvyplněné, po uložení další); překlepy jmen jako návrh přejmenování s potvrzením | M |

**Hotovo, když:** pro libovolný ročník je vidět, které Playmate chybí, a všechny jdou přidat jedna po druhé bez přepisování jmen.

#### 1.44 – Návrhy z webu ve frontě Údržby ✅ (9. 11. 2026)

**Cíl:** projít celou sbírku proti Wikidatům, Wikipedii a Boobpedii najednou a výsledky vyřizovat v Údržbě jako ostatní návrhy.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Průchod na pozadí | „Projít sbírku na webu…“ v Údržbě: 1 dotaz za sekundu na server, průběh a přerušení, pokračování po restartu (stav v `nastaveni`), jen modelky s chybějícími údaji nebo všechny | M |
| 2 | Návrhy ve frontě | Rozdíly jako „Návrhy doplnění“ se zdrojem a odkazem; přijmout po jednom, po poli nebo po zdroji; odmítnuté se pamatují (učení) a znovu se nenabízí | M |

**Hotovo, když:** po jednom průchodu jsou všechny rozdíly proti zdrojům ve frontě Údržby a nic se nezapsalo bez potvrzení.

#### 1.45 – Otočené fotky a návrh výřezu ✅ (10. 11. 2026)

**Cíl:** najít fotky na boku nebo vzhůru nohama a navrhnout výřez titulní fotky z obsahu fotek (bez rozpoznávání obličejů).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Otočené fotky | Vektory CLIP otočených variant náhledu (90°, 180°, 270°) proti původnímu; nejlepší shoda s „photo of a woman“ jiná než 0° = úkol Údržby „Otočené fotky“ s náhledem a otočením jedním klikem | M |
| 2 | Návrh výřezu titulní | Z detekce postavy (NudeNet, už spočítaná) střed a zoom výřezu; v okně výřezu tlačítko „Navrhnout“ a v Údržbě úkol pro titulní fotky bez výřezu | S–M |

**Hotovo, když:** Údržba najde otočené fotky s přesností, kterou uživatel potvrdí na vzorku 50 fotek, a výřez titulní jde navrhnout jedním klikem.

---

### Etapa F – Přehledy a pohodlí (1.46–1.48) ✅

#### 1.46 – Rok ve sbírce ✅ (10. 11. 2026)

**Cíl:** výroční přehled odvedené práce a objevů – co přibylo, co se líbilo a co se dokončilo.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Přehled roku | Ve Statistikách volba roku: přibylé modelky, alba, fotky a čísla (podle `pridano`), dokončené ročníky, nejlépe hodnocené nové fotky, nejaktivnější měsíc, nejdelší série dní práce | S–M |
| 2 | Jako časopis | Přehled roku jako stránky režimu čtení (1.41) a tisk do PDF | S |

**Hotovo, když:** pro každý rok práce na sbírce jde otevřít přehled a projít ho jako časopis.

#### 1.47 – Kapesní katalog offline ✅ (10. 11. 2026)

**Cíl:** mít sbírku v telefonu na burze i bez připojení – co mám, co sháním, kdo je v kterém čísle.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Export do složky | Statický HTML katalog (jeden soubor + náhledy w400 z mezipaměti náhledů, žádné plné fotky): čísla, Playmate, mám / sháním (po etapě I i stav výtisku), hledání v prohlížeči telefonu | M |
| 2 | Jen podmnožina | Volba: celá sbírka / jen česká edice / jen sháněná čísla; velikost před exportem | S |

**Hotovo, když:** složku lze nahrát do telefonu a v prohlížeči bez sítě najít, jestli číslo mám nebo sháním.

#### 1.48 – Upozornění na novou verzi ✅ (10. 11. 2026)

**Cíl:** dozvědět se o opravě bez sledování repozitáře (návrh R15 v `docs/PLAN-1X-ROZSIRENI.md`).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Kontrola verze | Jednou denně na pozadí `git fetch` ve vlastním klonu (cesta předaná při sestavení), porovnání `Verze` s `origin`; bez gitu, klonu nebo sítě mlčí; vypnutí v ⋯ | S–M |
| 2 | Co je nového | Nenápadné oznámení s nadpisy z `CHANGELOG.md` mezi verzemi a příkazem k aktualizaci | S |

**Hotovo, když:** po vydání nové verze se do dne objeví oznámení s jejím obsahem a nic se neinstaluje samo.

---

### Etapa G – Vzhled a čitelnost (1.49–1.51)

Nové volby vzhledu drží Rozhodnuto „střídmý vzhled, jeden růžový akcent, decentní zlatá jako doplněk, písmo aplikace“: mění velikost, hustotu,
světlost a pohyb, ne styl. Všechny jsou na jednom místě v ⋯ → Vzhled, ukládají se v `nastaveni` (nepovinná část
exportu). Schéma ani export se nemění.

#### 1.49 – Přiblížení, hustota a karty

**Cíl:** pohodlné čtení při dlouhé práci a víc informací na obrazovce tam, kde je potřeba (návrh R17 v `docs/PLAN-1X-ROZSIRENI.md`).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Přiblížení rozhraní | `Ctrl` + `+` / `-` / `0` a posuvník 90–150 % (`zoom` na kořenovém prvku, WebKitGTK ho podporuje); projít snímky mřížek, plakátů, hera a úzkého okna při 150 % | S–M |
| 2 | Hustota | Pohodlná / Kompaktní: mezery a výšky řádků jako proměnné (`--mezera-*`, `--radek-*`); v kompaktní Údržbě, seznamech a tabulkách Statistik víc řádků na obrazovku | S–M |
| 3 | Velikost a obsah karet | Galerie modelek, Všechny fotky, Centerfoldy a Kalendář: velikost S / M / L a co karta ukazuje (jméno, rok, srdíčka, počet fotek, edice, stav výtisku); platí pro každý pohled zvlášť | M |
| 4 | Okno Vzhled | Všechny volby etapy G na jednom místě s živým náhledem a tlačítkem Výchozí; zkratka v `Ctrl+K` | S |

**Hotovo, když:** rozhraní jde zvětšit na 150 % bez rozbitých mřížek a kompaktní Údržba ukáže na stejné obrazovce aspoň o 30 % víc řádků.

#### 1.50 – Světlý motiv a kontrast

**Cíl:** volitelný světlý motiv pro práci ve dne a vyšší kontrast, se stejným růžovým akcentem.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Barvy jen přes proměnné | Převést ~740 natvrdo zapsaných barev ve `style.css` na proměnné (`--povrch-*`, `--text-*`, `--cara-*`, `--stin-*`); test, který hlídá, aby nové natvrdo zapsané barvy nepřibývaly | M–L |
| 2 | Světlý motiv | Tmavý (výchozí) / Světlý / Podle systému (`prefers-color-scheme`); růžový akcent s ověřeným kontrastem 4,5 : 1 na obou pozadích, zlaté prvky (`--zlato-*`) se pro světlé pozadí jen ztmaví; prohlížeč fotek, režim čtení a promítání zůstávají vždy tmavé | M |
| 3 | Vyšší kontrast | Silnější tlumený text, okraje a tlustší rámeček fokusu; navazuje na popisky pro čtečku (R18) | S |

**Hotovo, když:** všechny pohledy ve světlém motivu projdou kontrolou kontrastu WCAG AA a motiv se přepne bez restartu.

#### 1.51 – Klid, pohyb a vlastní Přehled

**Cíl:** nastavit si, jak moc se rozhraní hýbe, jak vypadá prohlížeč fotek a co je na Přehledu.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Pohyb a efekty | Plné / Omezené / Žádné: přechody pohledů, Ken Burns, točící se úvod, prolínání, sbalování záhlaví; „Omezené“ = dnešní chování při systémovém omezení animací | S |
| 2 | Prohlížeč fotek | Pozadí rozmazané / černé / tmavě šedé; údaje fotky (srdíčka, tagy, číslo, album) trvale / po najetí / nikdy; volitelný filmový pás náhledů dole | S–M |
| 3 | Vlastní Přehled | Karty Přehledu (Dnešní výběr, Fotka dne, sezóna, chytré výběry ⚡, Zdraví sbírky, naposledy přidané) přeskládat tažením a skrýt; pohled po startu: Přehled / poslední pohled / Galerie | M |
| 4 | Záhlaví profilu | Vysoké / nízké / jen pruh a volba, zda se při rolování svine; výřez portrétu zůstává jeden | S |

**Hotovo, když:** volby přežijí restart a „Žádné“ vypne všechny animace v programu (ověřeno procházením všech pohledů).

---

### Etapa H – Návrat k hotovým funkcím (1.52–1.55)

Funkce z řady 1.24–1.45 rozšířit tam, kde se při používání ukázaly mezery, a dodělat zbytky z plánu (Mapa sbírky 1.30).
Žádná nová velká oblast. Schéma ani export se nemění, nová data jsou v `nastaveni` a v mezipaměti.

#### 1.52 – Údržba jako jedna fronta

**Cíl:** nepřepínat mezi sedmi režimy Údržby, ale dostat krátkou dávku toho nejcennějšího a vyřídit ji hromadně a bezpečně.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Dnes v Údržbě | Souhrn napříč režimy (Kontrola, Návrhy, Z webu, Stejné fotky, Otočené, výřezy) seřazený podle hodnoty: „15 minut práce“ = asi 30 úkolů, pokrok dne a série dní | M |
| 2 | Hromadně s náhledem | Ve všech režimech stejná lišta výběru, „Přijmout zobrazené“ s rozdílem nanečisto (jako u záloh v 1.42) a Vrátit | M |
| 3 | Panel Na pozadí | Otisky, obsah fotek, otočení, průchod webem a náhledy pod jedním panelem s průběhem, pořadím a pozastavením; připomínka „průchod webem je starý 60 dní“ (spuštění dál jen na kliknutí) | S–M |
| 4 | Kvalita fotek | Z náhledů w400: malé rozlišení, rozmazané (rozptyl Laplaciánu), přepálené nebo podexponované; úkol „Vyměnit za lepší“ s nabídkou podobné fotky ve vyšší kvalitě, když ve sbírce je (1.33) | M |

**Hotovo, když:** „Dnes v Údržbě“ jde projít z klávesnice za 15 minut a každá hromadná akce ukáže předem přesný rozdíl a jde vrátit.

#### 1.53 – Hledání a výběry 2

**Cíl:** chytré hledání (1.36) a chytré výběry (1.37) rozšířit o hledání obsahu slovy, složitější podmínky a novinky.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Obsah slovy všude | `foto:"na pláži v bílém"` přes český textový model (1.24) i v Galerii modelek (modelky, které takové fotky mají, seřazené podle shody) a v `Ctrl+K` | M |
| 2 | Nebo mezi příkazy a závorky | `(70. léta | 80. léta) výška > 175`, `blond | zrzavá` napříč příkazy (dnes jen čárkou uvnitř jednoho); pod polem věta „hledám modelky, které…“ | M |
| 3 | Výběry s novinkami | U výběru ⚡ odznak „+4 od minula“, výběr jako zdroj Časopisu (1.41), prezentace a Dnešního výběru | S–M |
| 4 | Historie hledání | Posledních 20 dotazů v našeptávači, oblíbený dotaz jednou zkratkou jako chytrý výběr | S |

**Hotovo, když:** `foto:"bazén" výška > 175` v Galerii modelek najde správné modelky a výběr ⚡ ukáže, co přibylo od posledního otevření.

#### 1.54 – Statistiky, mapa a vkus 2

**Cíl:** dodělat Mapu sbírky a ukázat, jak se v čase mění vlastní vkus.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Dokončit Mapu sbírky | Zbytky z 1.30: `<canvas>` nad 2 000 bodů, míra posunu pod mapou, „Přepočítat od začátku“; autoenkodér jen tehdy, když zachová sousedy lépe než PCA | M |
| 2 | Můj vkus v čase | Jak se mění srdíčka a oblíbené styly po měsících hodnocení; postřehy „letos se ti víc líbí…“ / „méně než dřív…“ s testy z `postrehy.js` | M |
| 3 | Objevit | Modelky a alba s nejvyšším odhadem srdíček, které ještě nemají hodnocení, s důvodem (podobné modelky 1.32 + vkus); karta v Přehledu | S–M |
| 4 | Graf ven | Graf nebo tabulku Statistik uložit jako PNG nebo CSV a vytisknout | S |

**Hotovo, když:** mapa s 3 000 modelkami se posouvá plynule a Statistiky ukážou aspoň jeden průkazný posun vkusu, pokud v datech je.

#### 1.55 – Prohlížení a časopis 2

**Cíl:** režim čtení (1.41) a prohlížeč fotek použít na víc míst a lépe využít výřezy z 1.45.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Časopis z čehokoli | Režim čtení pro ročník, chytrý výběr, sezónu a Síň slávy (pořadí jako stránky) přes `otevritStrany` jako Rok ve sbírce (1.46) | M |
| 2 | Dvoustrany podle výřezů | Rozvržení stran podle návrhu výřezu (1.45), aby postava nebyla pod textem; dvě fotky na šířku vedle sebe | S–M |
| 3 | Dvě fotky vedle sebe | V prohlížeči porovnání dvou fotek se sdílenou lupou a posunem; z prohlížeče „Nastavit jako titulní / profilovou“ rovnou s návrhem výřezu | M |
| 4 | Návrh titulní a profilové | Pro modelky bez nich návrh z vkusu, kvality (1.52) a výřezu (1.45) jako úkol Údržby | S |

**Hotovo, když:** jde promítat libovolný chytrý výběr jako časopis a modelky bez titulní fotky mají návrh na jeden klik.

---

### Etapa I – Sbírka výtisků (1.56–1.59)

Česká edice se sbírá fyzicky (Rozhodnuto: výtisky jen u CZ). Dnes program ví jen „mám / sháním“; tato etapa doplní,
v jakém stavu výtisk je, kolik stál a co jde vyměnit, a končí tiskovými sestavami (1.58, přesunuto z 1.43) a burzou; kapesní katalog (1.47) pak ukáže i stav výtisku.

#### 1.56 – Evidence výtisků české edice **[schéma]**

**Cíl:** u každého čísla české edice zapsat stav a původ výtisku tak rychle, jako se dnes přepíná „mám / sháním“.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Údaje výtisku | Stav (jako nový / velmi dobrý / dobrý / poškozený), chybí plakát nebo strany, počet kusů, cena, kde a kdy koupeno, poznámka; ohlášená úprava schématu č. 17 (tabulka `vytisky` s klíčem vydání) a export 14, převod ze sloupce `stav` beze ztráty | M |
| 2 | Rychlý zápis | V detailu čísla karta Výtisk, v Kalendáři klávesy pro stav; „Koupeno dnes za…“ jedním polem (cena a místo se pamatují z minula, našeptávač míst) | S–M |
| 3 | Hledání a filtry | Příkazy `vytisk:poškozený`, `cena:>200`, `koupeno:2026`, `kusu:>1`; čipy chytrého hledání (1.36) a chytré výběry (1.37) | S |

**Hotovo, když:** koupené číslo jde zapsat i se stavem a cenou do 10 s a hledání `vytisk:poškozený` najde výtisky k výměně za lepší.

#### 1.57 – Výdaje a hodnota sbírky

**Cíl:** vědět, kolik sbírka stála, kolik ještě bude stát a kde se nakupuje nejlépe.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Karta Výtisky ve Statistikách | Utraceno celkem a po letech nákupu, průměrná cena čísla podle ročníku vydání, místa nákupu s průměrnou cenou, nejdražší kusy; křivky s rozpětím (1.34) | S–M |
| 2 | Odhad do kompletu | Kolik čísel chybí a odhad ceny zbytku z průměrů daného období (medián, ne průměr; málo dat = rozpětí); u ročníku „do kompletu chybí 3 čísla, asi 450 Kč“ | S |

**Hotovo, když:** Statistiky ukážou výdaje po letech a u každého neúplného ročníku odhad, kolik stojí ho dokončit.

#### 1.58 – Rozšířené tiskové sestavy (katalog chybějících čísel a kapesní seznam; přesunuto z 1.43)

**Cíl:** vylepšit tiskové výstupy pro reálné použití v terénu (antikvariáty, burzy): kapesní seznam sháněných čísel na jednu stránku A4 a tiskový arch ročníku s obálkami.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Kapesní seznam „Sháním“ na 1× A4 | Kompaktní vícesloupcový tiskový výstup všech chybějících a sháněných čísel CZ/US edice se zaškrtávacími políčky a poznámkou o Playmate měsíce | S |
| 2 | Tiskový přehled ročníku s obálkami | Přehledová stránka vybraného ročníku (12 obálek + Playmate měsíce + stav ve sbírce) optimalizovaná pro tisk do PDF | S |

**Hotovo, když:** z Časopisů nebo Mapy sbírky lze jedním klikem vytisknout kompaktní seznam sháněných čísel na jednu stránku.

#### 1.59 – Burza a výměny

**Cíl:** připravit se na burzu nebo inzerát jedním klikem: co nabízím (duplikáty, horší kusy) a co sháním.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Nabízím / Sháním | Seznam duplikátů (kusů > 1) a výtisků k výměně za lepší stav, vedle sháněných čísel; text ke zkopírování do inzerátu (prostý text i markdown) | S |
| 2 | Tisk pro burzu | Rozšíření kapesního seznamu z 1.58 o sloupec „nabízím“ a cenový strop u sháněných čísel | S |

**Hotovo, když:** jedním klikem vznikne text inzerátu „Nabízím / Sháním“ a tiskový arch na burzu.

---

### Etapa J – Odložené: Kvíz, průvodce číslem a Google Disk (1.60–1.63)

Na přání uživatele odložené na konec plánu (kvíz z 1.43, průvodce číslem z 1.36 a 1.38, Google Disk z 1.38–1.39); vkládání z Disku stojí na prohlížeči Disku, proto jdou spolu.

#### 1.60 – Kvíz „Poznej playmate“ (odloženo z 1.43)

**Cíl:** odlehčená znalostní hra nad vlastní sbírkou přímo v aplikaci (statistiky a Leitnerovy krabičky uložené v `nastaveni`, bez změny schématu DB).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Hra „Kdo je to?“ a „Který rok / číslo?“ | Titulní fotka nebo obálka a 4 možnosti (lehká = náhodné, těžká = podobné modelky ze stejného desetiletí), ovládání klávesami `1`–`4`, `Enter`, `Esc` | M |
| 2 | Skóre, série a opakování chyb | Evidence úspěšnosti a nejdelší série v `nastaveni`, po hře přehled chyb s proklikem na profil, častější zařazování modelek, které uživatel plete | S |

**Hotovo, když:** deset otázek lze odehrát čistě z klávesnice, po hře se zobrazí přehled chyb s proklikem na profily a statistiky přežijí restart.

#### 1.61 – Průvodce přidáním celého čísla (odloženo z 1.36 a 1.38)

**Cíl:** přidat celé číslo časopisu (obálka, Playmate měsíce, další modelky na obálce a v čísle, rozhovor, fotky) v jednom souvislém průvodci se živou kontrolou úplnosti a tlačítkem „Vrátit přidání“.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Průvodce číslem | Kroky: 1. Základ a obálka → 2. Playmate měsíce (výběr existující nebo inline vytvoření nové) → 3. Další modelky a rozhovor → 4. Shrnutí s kontrolou úplnosti | M–L |
| 2 | Odhad dalšího chybějícího čísla | Tlačítko „+ Přidat další chybějící“ v Časopisech a v Mapě sbírky rovnou předvyplní nejbližší chybějící měsíc a rok | S |
| 3 | Cílené „Vrátit přidání“ | Po uložení průvodce lišta s možností vrátit celé právě přidané číslo (včetně nově vytvořených záznamů z tohoto kroku) | M |

**Hotovo, když:** celé číslo s obálkou, Playmate měsíce, rozhovorem a fotkami vznikne v jednom okně bez překlikávání a lze ho jedním klikem vrátit.

#### 1.62 – Google Disk v aplikaci (OAuth 2.0 + prohlížeč složek)

**Cíl:** volitelné přihlášení ke Google Disku (`golang.org/x/oauth2`, rozsah `drive.readonly` / `drive.file`) s prohlížením vlastní složky Playboy přímo v okně programu, bez nutnosti ručně kopírovat odkazy z prohlížeče. Návrh v [NAVRH-GOOGLE-DISK.md](docs/NAVRH-GOOGLE-DISK.md).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Přihlášení a správa přístupu | OAuth 2.0 se systémovým prohlížečem a návratem na `127.0.0.1`, uložení tokenu s právy `0600`, kořenová složka a odhlášení v Nastavení | M |
| 2 | Prohlížeč složek a fotek | Strom složek, drobečková cesta, hledání složky, mřížka náhledů s indikací „už je v databázi“ | M |

**Hotovo, když:** přihlášený uživatel vidí své složky na Disku přímo v programu a pozná, které fotky už v databázi jsou.

#### 1.63 – Vkládání fotek a obálek přímo z Disku

**Cíl:** napojit prohlížeč Google Disku (1.62) na zásobník fotek v detailu modelky, na obálku čísla a na hromadný import složky.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Výběr pro modelku a obálku | Tlačítko „Vybrat z Disku…“ u fotek modelky, v průvodci číslem a u obálky; automatické předvyplnění hledání jménem modelky nebo číslem vydání | M |
| 2 | Chytré zařazení celé složky | Načtení složky s návrhem rozdělení (1. fotka = obálka / titulní, další = běžné fotky), přeskočení již evidovaných fotek | S–M |

**Hotovo, když:** fotky celé modelky nebo čísla lze vybrat z Disku v jednom okně bez kopírování URL adres.

---

## Rozhodnuto

- Album jako záznam (0.10.0); řazení galerie abecedně, naposledy přidané, rok prvního vydání; speciály zvlášť;
  národní edice US a CZ (0.13.0).
- Výtisky se sbírají jen u české edice (mám výtisk, sháním); americká edice je archiv dat (0.34.2). Česká edice
  začíná číslem 07/2011 (0.51.6).
- Měsíční řady edic (`RADY_EDIC` v `frontend/src/lib/format.js`, 0.51.8): americká od 12/1953 do 03/2020 (Spring 2020,
  poslední pravidelné číslo), od 2025 ročenka a čtvrtletník evidované jako speciály; česká od 07/2011. Jednotlivá
  čísla, která nevyšla, jsou v `NEVYSLA_CISLA` (americké z března 1955, 0.51.7).
- Dvě modelky stejného jména se liší datem narození; data narození a úmrtí RRRR, RRRR-MM nebo RRRR-MM-DD;
  hodnota „-“ v importu údaj smaže; překlep v klíči souboru se opraví na nejbližší známý klíč (0.18.0–0.30.0).
- Vzhled: střídmý, jeden růžový akcent a decentní zlatá jako doplněk (proměnné `--zlato-*`, např. lem záhlaví profilu;
  ne jako druhý akcent tlačítek a voleb), písmo aplikace i v nadpisech (patkové písmo vráceno v 0.34.1; výjimkou
  je režim čtení 1.41). Potvrzeno 10. 11. 2026 při plánu etapy G.
- Google Disk: zobrazování zůstává přes sdílené odkazy, Google API přibude jen pro výběr fotek v programu (1.62–1.63).
- Malé náhledy smí program ukládat na disk jako mezipaměť (1.6); originály a velké fotky zůstávají jen na Disku.
- 1.0.0 po 14 dnech používání bety bez nové chyby (21. 10. 2026); po 1.0.0 MINOR pro téma z plánu, PATCH pro
  každý krok a opravu v tématu; MAJOR = velký milník, kompatibilitu dat hlídá verze schématu a exportu.
- Editor textů (1.40): vlastní lišta nad markdownem s náhledem, žádná knihovna editoru.
- Wikidata, Wikipedie a Boobpedia (1.38) jen na kliknutí a s potvrzením každého údaje; Babepedia ani jiné weby bez API se nečtou.

## Nedělat

- Obecné Zpět pro všechny úpravy (deník změn) – denní zálohy, Vrátit u fotek a Vrátit přidání čísla stačí.
- Místní kopie fotek v plné velikosti (malé náhledy jako mezipaměť ano, viz 1.6), zálohy na jiný disk.
- Šifrovanou databázi – zvolen zámek rozhraní.
- Půlsrdíčka.
- Zobrazování fotek přes Google API s přihlášením (API jen k výběru fotek); automatický import celé
  složky bez výběru, automatické stahování a zápis údajů z webu bez potvrzení (Wikidata jen na kliknutí
  a s potvrzením každého údaje), rozpoznávání obličejů.
- Nové funkce v alfě a betě a neohlášené změny schématu nebo exportu (`TestZmrazeniAlfy`).
- Vše z oddílu „Rozhodnuto nedělat“ v `PLAN.md`.
