# Plán 1.8–1.11: editor textů a Wikidata

Stav k 23. 10. 2026 (verze 0.99.3). Rozpracování verzí 1.8 Editor I, 1.9 Editor II, 1.10 Wikidata I a 1.11
Wikidata II z `ROADMAP.md` na dílčí kroky (každý krok = PATCH: 1.8.0, 1.8.1…) a návrh rozšíření kolem textů
a doplňování údajů. Nic z toho není rozhodnuté; hotové oddíly k vložení do `ROADMAP.md` jsou na konci.
Wikidata (1.10–1.11) zůstávají **podmíněné rozhodnutím uživatele** o bodu Nedělat „stahování údajů z webu“.
Rozbor Wikidat (rozhraní, vlastnosti, párování, rizika) je v [NAVRH-NAPADY.md](NAVRH-NAPADY.md), nápad 1
(tam jako 1.12–1.13); tady se neopakuje, jen se rozkládá na kroky.

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export.
Žádný krok v tomto plánu schéma ani export nemění (schéma zůstává na úpravě č. 11, po 1.5 č. 12; export 7, po 1.5 8).

Podle čeho: sbírka kolem 400 modelek, přibývají desítky denně chronologicky (teď rok 1977), uživatel přepisuje
články a rozhovory z časopisů (české výtisky, americká čísla ze skenů na Disku). Editor je tedy nástroj na
**dlouhé přepisy**: nesmí ztratit text, musí jít ovládat klávesnicí a mít předlohu (sken) na očích.

## Výchozí stav v kódu

| Co | Kde | Pro plán |
|---|---|---|
| Převod markdownu | `formatMarkdown(text, {perex, mluvci})` a `markdownVRadku` v `frontend/src/lib/format.js`: odstavce, `#`–`###`, `>`, odrážky `* - • –`, číslování `1.`, pokračovací řádek odrážky (odsazený), tučné, kurzíva, kód, přeškrtnutí; vše přes `esc()` | Náhled použije přesně tuto funkci. **Neumí odkazy** `[text](url)` ani vnořené seznamy – tlačítko Odkaz z 1.8 potřebuje nejdřív převod |
| Mluvčí | `mluvci: true` zvýrazní `VELKÁ SLOVA:` na začátku řádku (2–31 znaků) | Rozhovory v 1.9 na tom stojí; „Q:“ (1 písmeno) se nezvýrazní |
| Testy převodu | `frontend/test/lib.test.js` (`node --test`) | Nové čisté funkce editoru do `lib`, testy tamtéž |
| Článek | okno `#clanekModal` v `sablona.js` (textarea `inputClanekText`, rows 10, nápověda markdownu pod polem), obsluha `otevritEditorClanku` a `clanekForm.onsubmit` v `app/clanky.js`; zobrazení `htmlTextuClanku` (perex + mluvčí) | Hlavní místo editoru |
| Další texty | `inputAlbumPopis` (okno alba, zobrazení `profil.js` a `vydani.js` → `htmlPopisuAlba`), `inputPoznamka` (modelka), `inputIssuePoznamka` (číslo, `vydani.js`) | Jeden editor všude v 1.9 |
| Ochrana rozepsaného | `oknaSFormularem()` v `app/ulozeni.js` = jen okno modelky, alba a coveru; Esc (`nabidky.js`) zavře horní okno přes `zavritOkno` | **Okno článku a okno čísla nejsou chráněné: Esc nebo Zrušit zahodí rozepsaný přepis bez dotazu** |
| Klávesy | Ctrl+F (`ulozeni.js`) v otevřeném okně nic nedělá; `?` a jednopísmenné zkratky textová pole vynechávají; Tab v textarea přesouvá fokus | Ctrl+F/Ctrl+H v editoru jsou volné; Tab v editoru jen v odrážkách |
| Odkazy | `htmlOdkazu` v `profil.js` (pole Odkazy, jeden na řádek, http/https) → `data-odkaz`; klik v `main` otevře `BrowserOpenURL` (`prohlizec.js`); `data-modelka` otevře profil | Odkazy v textu a jména modelek v textu stačí vykreslit s těmito atributy |
| Skeny | `Clanek.Skeny`/`SkenyURL` (`clanky.go`), prohlížeč stran `app/ctecka.js` (dvojstrana/jedna strana, `w2000`) | Sken vedle editoru znovu použije výpočet stran z čtečky |
| Hledání v textech | FTS5 `texty_fts` (články + popisy alb, `clanky.go`), `HledatClanky` s úryvkem do našeptávače (`zvyraznit` v `naseptavac.js`); `HledatTexty` rozhraní nepoužívá | Zvýraznění v otevřeném článku chybí |
| Kontextová nabídka | Wails v produkci vypíná nabídku WebKitu (`DisableContextMenu`, pokud není `EnableDefaultContextMenu`); vlastní nabídka programu v textových polích nic nedělá | Návrhy pravopisu potřebují zapnout nabídku WebKitu |
| Pravopis | WebKitGTK má kontrolu pravopisu vypnutou, Wails 2.16 ji nezapíná; používá `webkit_web_context_get_default()` | Zapnout jde vlastním cgo voláním na výchozí kontext (sestavení už je cgo s `webkit2_41`) |
| CSP | `frontend/index.html`: `script-src 'self'; object-src 'none'; base-uri 'none'` | Editor bez knihovny a bez `eval` vyhovuje; síť (Wikidata) patří do Go |
| Síť z Go | `klientDisku` (`http.Client`, 20 s) a vyměnitelná `overitSoubor` v `app.go`; výpadek = „neověřeno“ | Stejný vzor pro `wikidata.go` |
| Úložiště prohlížeče | `localStorage` jen pro pohodlí (režim čtečky, řazení galerie), vždy v `try` | Koncept rozepsaného textu a režim editoru smí být tam |

---

## 1.8 – Editor I: lišta, náhled, zkratky

**Cíl:** přepis článku bez psaní značek zpaměti a bez rizika ztráty textu. Zatím jen v okně článku (nejdelší
texty); ostatní pole převezmou editor v 1.9. Text se dál ukládá jako markdown, starší texty beze změny.

**Rozhodnutí (ROADMAP):** vlastní lehký editor nad `<textarea>`, náhled stávajícím `formatMarkdown`, žádná
knihovna. Vložení značky přes `document.execCommand('insertText')` (WebKit ho drží v historii Ctrl+Z);
přímé `textarea.value = …` by historii Zpět smazalo.

### 1.8.0 – Ochrana rozepsaného textu (S)

- **Co:** `oknaSFormularem()` v `ulozeni.js` doplnit o `#clanekModal` a okno čísla `#issueModal`, takže Esc,
  Zrušit i křížek se zeptají „Zahodit změny?“. Koncept: při psaní v textu článku se každých 5 s a při zavření
  okna uloží `{vydani, id, text, cas}` do `localStorage` (klíč `konceptClanku`, jen poslední). Při otevření
  stejného článku s novějším konceptem, než je uložený text, lišta nad polem nabídne obnovu.
- **UI:**
  ```
  ⓘ Máš neuložený koncept z 23. 10. 14:32 (1 240 slov).   [Obnovit koncept] [Zahodit]
  ```
- **Testy:** `lib.test.js` – rozhodnutí „nabídnout koncept“ (novější, jiný text, jiný článek ne); ruční: Esc
  v rozepsaném článku se zeptá.
- **Rizika:** prázdný `localStorage` nebo výjimka → koncept se jen nenabídne; koncept po uložení smazat.
- **Hotovo, když:** rozepsaný článek nejde zavřít Esc bez dotazu a po pádu programu jde text obnovit.
- **Ověří uživatel:** napíše odstavec, stiskne Esc → dotaz; zavře okno „Zahodit“, otevře znovu → nabídka konceptu.

### 1.8.1 – Lišta a odkazy v textu (M)

- **Co:** `frontend/src/lib/editor.js` – čisté funkce nad `(text, od, do)` vracející `{text, od, do}`:
  `obalit(znacka)` (tučné, kurzíva; podruhé značku odebere), `prefixRadku(prefix)` (nadpis, odrážky, číslování
  s přečíslováním, citace; přepíná), `vlozitOdkaz(url)`. `frontend/src/ui/editor.js` – `pripojitEditor(textarea,
  volby)`: vytvoří lištu nad polem, výsledek zapíše přes `insertText`. Převod: `markdownVRadku` pozná
  `[text](https://…)` a vykreslí `<button class="link" data-odkaz="…">` (jen https, jinak zůstane text);
  `formatMarkdown` se jinak nemění. Nápověda pod polem v `sablona.js` se zkrátí na „Značky vloží lišta“.
- **UI:**
  ```
  Text  [B] [I] [H▾] [• ] [1.] [❝] [🔗]                              Psaní · Náhled · Vedle sebe
  ┌──────────────────────────────────────────────────────────────────────────────────────────┐
  │ PLAYBOY: Jak jste se dostala k focení?                                                   │
  ```
- **Testy:** `lib.test.js` – obalení výběru i prázdného kurzoru, odebrání značky, prefix na více řádcích,
  přečíslování, odkaz s `&` a `"` v adrese (escapování), `javascript:` a `http:` se nevykreslí jako odkaz;
  všechny dosavadní testy převodu beze změny.
- **Rizika:** `execCommand` je zastaralé, ve WebKitGTK ale funguje (ověřit Ctrl+Z na Fedoře); záloha =
  přímý zápis bez historie. Kurzíva `*` uvnitř tučného (`***`) – testy.
- **Hotovo, když:** článek jde naformátovat jen lištou; Ctrl+Z vrátí každé vložení; odkaz v textu otevře prohlížeč.
- **Ověří uživatel:** v kopii sbírky naformátuje existující článek lištou, uloží, zkontroluje zobrazení v čísle.

### 1.8.2 – Náhled (M)

- **Co:** v `ui/editor.js` přepínač Psaní / Náhled / Vedle sebe; náhled = `formatMarkdown` se stejnými volbami
  jako cílové zobrazení (článek `{perex, mluvci}`, ostatní bez), překreslení se zpožděním 150 ms, stejné třídy
  jako `.clanek-text`, takže náhled vypadá jako číslo. Vedle sebe jen při šířce okna ≥ 900 px, jinak se nabídne
  Náhled. Rolování náhledu sleduje kurzor (poměr řádků). Zvolený režim v `localStorage`.
- **Testy:** text uložený před 1.8 (vzorky z `testdata`) dá stejné HTML v náhledu i v čísle; 30 000 znaků
  se překreslí do 20 ms (měření v Node).
- **Rizika:** dlouhé texty (rozhovor 8 000 slov) – zpoždění a měření; úzké okno (min. 280 px).
- **Hotovo, když:** texty uložené před 1.8 vypadají v náhledu stejně jako v čísle; vedle sebe se při psaní nezadrhává.
- **Ověří uživatel:** otevře nejdelší rozhovor v režimu Vedle sebe a píše.

### 1.8.3 – Zkratky, celé okno, počet slov (S–M)

- **Co:** Ctrl+B, Ctrl+I, Ctrl+K (odkaz: vybraný text + adresa ze schránky, pokud je https), Ctrl+1–3 nadpisy,
  Ctrl+Shift+8 odrážky, Ctrl+Shift+7 číslování. Enter v odrážce pokračuje odrážkou (v číslování dalším číslem),
  Enter na prázdné odrážce seznam ukončí; Tab / Shift+Tab jen v odrážce (odsazení = pokračovací řádek, jak ho
  zná převod), jinde Tab dál přesouvá fokus. Tlačítko ⤢ a Ctrl+Shift+F zvětší okno článku na celé okno, Esc
  nejdřív zmenší, teprve potom zavře. Stavový řádek: počet slov a znaků, odhad čtení (200 slov/min).
- **UI:**
  ```
  1 240 slov · 7 380 znaků · čtení 6 min                                   Ctrl+B tučné · ⤢ celé okno
  ```
- **Testy:** `lib.test.js` – pokračování a ukončení seznamu, přečíslování po Enteru, počet slov bez značek
  (`**`, `#`, `>`, mluvčí). Přehled zkratek `zkratky.js` doplněný o oddíl Editor.
- **Rizika:** kolize s globálními zkratkami (Ctrl+F v okně je volné, `?` pole vynechává); Ctrl+Shift+F nesmí
  spustit hledání.
- **Hotovo, když:** článek jde napsat a naformátovat bez myši; Esc v celém okně nezahodí text.
- **Ověří uživatel:** přepíše jednu stranu článku jen klávesnicí.

**Hotovo 1.8, když:** článek jde naformátovat bez ručně psaných značek; texty uložené před 1.8 vypadají
v náhledu stejně jako dřív; rozepsaný text se neztratí zavřením okna ani pádem programu.

---

## 1.9 – Editor II: rozhovory, jeden editor všude, sken a pravopis

**Cíl:** přepis rozhovorů bez psaní značek, stejný editor u všech textů, předloha vedle textu a kontrola pravopisu.

### 1.9.0 – Rozhovory a šablony rubrik (S–M)

- **Co:** při prázdném textu a rubrice z `RUBRIKY` (`clanky.js`) nabídka šablony (nikdy se nevloží sama):
  *Playboy Interview* (perex, `PLAYBOY:` / `JMÉNO:` z pole Modelka velkými písmeny), *20 otázek* (perex,
  `1.` až `20.` jako `PLAYBOY:`/odpověď), *Advisor* (dotaz čtenáře v citaci, odpověď), *Povídka* (perex, text).
  Mluvčí se zjistí z textu (`lib/editor.js`: `mluvciTextu(text)`); po prázdném řádku za odpovědí ukáže lišta
  „Další: PLAYBOY: (Tab)“ a Tab ho vloží; Alt+M přepíná mezi mluvčími na začátku odstavce. Lišta dostane
  tlačítko [Mluvčí▾].
- **UI:**
  ```
  Text je prázdný. Rubrika Playboy Interview →  [Vložit šablonu rozhovoru]  [Bez šablony]
  …
  JANA UKÁZKOVÁ: Bylo mi devatenáct…
  ▏                                                               Další: PLAYBOY:  (Tab)
  ```
- **Testy:** šablony projdou `formatMarkdown` s perexem a mluvčími; střídání mluvčích, jméno s diakritikou
  a pomlčkou, jméno delší než 31 znaků (regex mluvčího) – buď zkrátit na příjmení, nebo rozšířit regex s testem.
- **Rizika:** přepsání Enteru by vadilo – proto návrh na Tab, ne automaticky.
- **Hotovo, když:** rozhovor o deseti otázkách jde přepsat bez jediné ručně psané značky.
- **Ověří uživatel:** přepíše rozhovor z čísla 1977.

### 1.9.1 – Jeden editor všude (S–M)

- **Co:** `pripojitEditor` na `inputAlbumPopis`, `inputPoznamka`, `inputIssuePoznamka` (a pole popisu v okně
  Doplnit modelku, pokud tam je); malá varianta: lišta bez nadpisů, Náhled místo Vedle sebe, celé okno ano.
  Volby náhledu podle cílového zobrazení (popis alba a poznámky bez perexu). Nápověda (`napoveda.js`) a přehled
  zkratek doplněné; staré nápovědy „Markdown: **tučné**…“ v `placeholder` pryč.
- **Testy:** všechna čtyři pole: lišta, zkratky, koncept jen u článku; okna modelky a alba dál hlásí změny.
- **Rizika:** okno alba je úzké – lišta se zalomí; ověřit v úzkém okně (pravidla z 0.51.10).
- **Hotovo, když:** články, alba i poznámky mají stejný editor a zkratky.
- **Ověří uživatel:** popis alba a poznámku čísla naformátuje lištou.

### 1.9.2 – Sken vedle textu (M) – rozšíření

- **Co:** v celém okně článku panel „Předloha“ vlevo od textu: skeny z pole Skeny stran (ID z odkazů jako
  `parseDriveIDs`, v JS stejný vzor jako u vkládání fotek), jedna strana, `w2000`, přiblížení kolečkem
  a tažením, listování Alt+PageUp / Alt+PageDown bez opuštění textu (fokus zůstává v poli). Výpočet strany ze
  `ctecka.js` vytáhnout do sdílené funkce. Bez skenů panel nabídne „Bez skenu – přepisuješ z výtisku“ a schová se.
- **UI:**
  ```
  ┌ Předloha · strana 27 / 4 ─────────┐ ┌ Text ── [B][I][…] ─────────────────────┐
  │                                   │ │ PLAYBOY: Jak jste…                     │
  │          sken strany              │ │                                        │
  │  Alt+PgUp ‹            › Alt+PgDn │ │ 1 240 slov · čtení 6 min               │
  └───────────────────────────────────┘ └────────────────────────────────────────┘
  ```
- **Testy:** sdílená funkce stran (lichá první strana, jedna strana) v `lib.test.js`; čtečka beze změny.
- **Rizika:** bez připojení se sken nenačte (velké obrázky mezipaměť z 1.3 nemá) → hláška „Nenačteno“;
  šířka okna < 1100 px → předloha jako přepínač místo vedle sebe.
- **Hotovo, když:** čtyřstránkový článek jde přepsat se skenem vedle, bez myši.
- **Ověří uživatel:** přepíše americký článek ze skenů na Disku.

### 1.9.3 – Kontrola pravopisu (S–M, ověřit na Fedoře) – rozšíření

- **Co:** `pravopis_linux.go` (cgo, `pkg-config: webkit2gtk-4.1`): v `OnStartup` zavolat
  `webkit_web_context_set_spell_checking_enabled(webkit_web_context_get_default(), TRUE)` a jazyky
  `cs_CZ`, `en_US`. V `main.go` `EnableDefaultContextMenu: true` – nabídka WebKitu s návrhy se ukáže jen
  v textových polích, protože vlastní obsluha `contextmenu` (`nabidky.js`) mimo pole volá `preventDefault`.
  Editory `spellcheck="true" lang="cs"`, pole jmen, odkazů a skenů `spellcheck="false"`. `instalovat.sh`
  ohlásí chybějící slovník (`hunspell-cs`, `hunspell-en`) a README ho uvede v `dnf install`.
- **Testy:** sestavení s tagem `webkit2_41`; ruční na Fedoře: podtržení, návrhy v nabídce, přidání slova.
- **Rizika:** Wails může kontext nastavit až po našem volání (pořadí ověřit; jinak volat přes
  `runtime` po načtení okna); nabídka WebKitu nesmí ukázat „Prozkoumat prvek“ (vývojářské doplňky jsou
  v produkci vypnuté); anglická jména v textu budou podtržená (přidat do slovníku). Bez slovníku vše funguje,
  jen bez podtržení.
- **Hotovo, když:** překlep v článku je podtržený a pravé tlačítko nabídne opravu; jinde se nic nezměnilo.
- **Ověří uživatel:** napíše „časpois“ a opraví ho z nabídky.

**Hotovo 1.9, když:** rozhovor o deseti otázkách jde přepsat bez jediné ručně psané značky; články, alba
i poznámky mají stejný editor a zkratky; sken je vedle textu; překlepy jsou podtržené.

---

## 1.10 – Wikidata I: návrh údajů u modelky (podmíněně)

**Čeká na rozhodnutí uživatele.** Odporuje bodu Nedělat „stahování údajů z webu“. Návrh: upřesnit na
„automatické stahování a zápis údajů z webu bez potvrzení“. Když uživatel nerozhodne nebo odmítne, 1.10–1.11
se vynechají a nic dalšího na nich nezávisí. Bez změny schématu i exportu: původ = řádek
`https://www.wikidata.org/wiki/Q…` v Odkazech, odmítnuté hodnoty v `nastaveni` (`wikidata_odmitnuto`).

**Krok před vydáním (mimo hlavní větev, S):** prototyp a pokrytí – pro 40 modelek 1953–1977 ze sbírky změřit,
kolik jich Wikidata mají s oceněním Playmate měsíce a datem (P166 + P585), datem narození (P569), výškou
(P2048); zjistit QID ocenění; uložit odpovědi do `testdata/wikidata/`. **Rozhodne, zda pokračovat:** pod 50 %
pokrytí dat narození u 50.–70. let se 1.10 nevyplatí.

### 1.10.0 – Klient a porovnání jen ke čtení (M)

- **Co:** `wikidata.go`: `var stahnoutWikidata = stahnoutWikidataZWebu` (vyměnitelná jako `overitSoubor`),
  vlastní `http.Client` (15 s), `User-Agent: PlayboyDatabase/<Verze> (osobní katalog; adresa repozitáře)`,
  `maxlag=5`, jeden dotaz naráz, 429 → čekat podle `Retry-After`. Mezipaměť `~/.cache/playboy-app/wikidata/`
  (QID → JSON, 30 dní). Převody: přesnost data 9/10/11 → `RRRR`/`RRRR-MM`/`RRRR-MM-DD` (ověří `platneDatum`),
  jednotky (cm, m, in, ft, kg, lb), stát → hodnoty sbírky (mapa; neznámý se jen ukáže). Vazba
  `NavrhnoutZWikidat(modelkaID) NavrhWikidat` pro modelku s odkazem na Wikipedii nebo Wikidata v Odkazech.
  V profilu ⋯ → „Porovnat s Wikidaty…“: tabulka Ve sbírce / Wikidata, **zatím bez ukládání**.
- **Testy:** převody na souborech z `testdata/wikidata/`; bez sítě vrátí „neověřeno“ a nic nezmění;
  `User-Agent` a `maxlag` v dotazu (zachycený požadavek).
- **Hotovo, když:** u modelky s odkazem na Wikipedii okno ukáže údaje vedle sebe; bez připojení hláška.
- **Ověří uživatel:** 10 modelek s odkazem na Wikipedii, porovná s článkem.

### 1.10.1 – Spárování bez odkazu (M)

- **Co:** kandidáti přes `wbsearchentities` (jméno a `DalsiJmena`), načtení `wbgetentities` po 50; skóre
  (měsíc centerfoldu = ocenění s P585, shodné datum narození, `jaroWinkler` ≥ 0,92 z `kontrola_uceni.go`,
  popis s „Playboy/Playmate/model“); **rozporné datum narození kandidáta vylučuje**. Jistá shoda → rovnou
  porovnání; možná → výběr ze 2–3 kandidátů s popisem a datem; žádná → „Nenalezeno“ a pole pro QID nebo odkaz.
- **UI:**
  ```
  Porovnat s Wikidaty – Jana Ukázková
  Možná shoda – vyber osobu:
   ( ) Q123  Jana Ukázková – American model, Playboy Playmate · nar. 1955 · Playmate 06/1976
   ( ) Q456  Jana Ukázková – American actress · nar. 1949
   [Žádná z nich]   nebo QID / odkaz: [__________]
  ```
- **Testy:** skóre na připravených kandidátech (sitelink, měsíc, rozporné datum, podobné jméno jiné osoby).
- **Hotovo, když:** u 20 zkušebních modelek bez odkazu je jistá shoda vždy správná.

### 1.10.2 – Převzetí po polích (M)

- **Co:** `PrevzitZWikidat(modelkaID, qid, pole []string) Puvodni` – načte modelku znovu, změní jen vybraná pole
  přes `UpdateModelka` (`overitDataModelky`), přidá řádek Wikidat do Odkazů, vrátí původní hodnoty pro Vrátit.
  Výchozí zaškrtnutí: prázdné pole ano, přesnější datum se shodným začátkem ano, rozdíl ne s ⚠; hodnota mimo
  rozsah `kontrolovatPostavu` = ⚠ a nezaškrtnuto. Odmítnuté (nezaškrtnuté při uložení) do `nastaveni`; nová
  hodnota na Wikidatech se nabídne znovu. Tlačítko i v okně „Doplnit modelku“ (`doplneni.js`).
- **UI:** jako v NAVRH-NAPADY.md (zaškrtávací tabulka, „Uložit vybrané (3)“, oznámení s Vrátit).
- **Testy:** mění jen vybraná pole; Vrátit obnoví; odmítnutá hodnota se nenabídne; etnicita a fotky se nenabízí nikdy.
- **Hotovo, když:** nic se neuloží bez potvrzení; Vrátit vrátí přesně původní údaje; schéma ani export se nemění.
- **Ověří uživatel:** doplní data narození pěti modelkám z roku 1977, jednu vrátí.

**Hotovo 1.10, když:** u 20 zkušebních modelek návrh odpovídá Wikipedii, nic se neuloží bez potvrzení, bez
připojení volba ohlásí výpadek a nic nezmění.

---

## 1.11 – Wikidata II: hromadně a pro další rok (podmíněně)

### 1.11.0 – Katalog playmate (S–M)

- **Co:** jeden dotaz SPARQL (`query.wikidata.org`) na všechny nositelky ocenění Playmate měsíce a roku s P585,
  P569, P2048, sitelinky; uložení `~/.cache/playboy-app/wikidata/katalog.json` (obnova na kliknutí, nejdřív po
  7 dnech). Párování podle měsíce centerfoldu (US) + jména. **Offline:** s katalogem v mezipaměti fungují
  návrhy i bez připojení (označené „z mezipaměti, stáří N dní“).
- **Testy:** uložená odpověď SPARQL v `testdata`; dvojčata (dva centerfoldy v měsíci); přetížená služba (429,
  60 s) → spadne na A (po modelce).
- **Hotovo, když:** katalog se stáhne jedním dotazem a spáruje ≥ 90 % centerfoldů 1953–1977 ve sbírce.

### 1.11.1 – Filtr „Z Wikidat“ v Údržbě (M)

- **Co:** filtr v `FILTRY_UDRZBY` (`prehled.js`): „Zjistit návrhy pro N modelek bez data narození“ (i bez
  výšky, místa), postup s pozastavením (nejvýš 1 dotaz/s mimo katalog), fronta návrhů; „Projít…“ otevře okno
  z 1.10.2, „Přijmout vše bez ⚠“ jen pro jisté shody a jen prázdná pole; Vrátit celé dávky. Druhá skupina
  „Rozdíly“: vyplněné údaje, které se liší (170 vs 173 cm) – jen k posouzení, nic se nemění.
- **Testy:** dávka 100 modelek se simulovanou sítí: žádné dva dotazy do 1 s, 429 pozastaví, Vrátit dávky.
- **Hotovo, když:** dávka 100 modelek bez data narození doběhne bez chyby 429 a přijetí návrhů jde vrátit.

### 1.11.2 – Příprava dalšího roku (S–M) – rozšíření

- **Co:** uživatel přidává chronologicky; na stránce ročníku a v kalendáři u měsíce bez centerfoldu z katalogu
  „Podle Wikidat: Jana Ukázková (06/1978)“ → „Založit modelku…“ otevře formulář s předvyplněným jménem, datem
  narození a vydáním centerfoldu; uloží se až tlačítkem Uložit. Rozdíl jména (jiný zápis) se ukáže.
- **Rizika:** nejblíž hranici „automatický import“ – proto jen předvyplnění formuláře, žádné hromadné založení.
- **Hotovo, když:** u roku 1978 ukáže kalendář jména pro prázdné měsíce a založení projde jen přes formulář.

---

## Rozšíření

| # | Rozšíření | Hodnota | Prac. | Schéma / export | Zařazení |
|---|---|---|---|---|---|
| R1 | Ochrana rozepsaného textu, koncept | vysoká – dnes Esc zahodí přepis | S | ne (`localStorage`) | **1.8.0** |
| R2 | Počet slov, znaků, doba čtení | střední, pro přepisy | S | ne | **1.8.3** |
| R3 | Šablony rubrik (Interview, 20 otázek, Advisor, Povídka) | střední | S | ne | **1.9.0** |
| R4 | Sken vedle editoru | vysoká u amerických čísel | M | ne | **1.9.2** |
| R5 | Kontrola pravopisu WebKitGTK (cs + en) | vysoká, nulová závislost v programu | S–M | ne | **1.9.3** |
| R6 | Jména modelek v textu jako odkaz na profil (`[[Jméno]]`, našeptávač po `[[`), v profilu „Zmínky v článcích“ | vysoká – rozhovory zmiňují další playmate | M | ne (zápis v textu) | **1.12 (návrh)** |
| R7 | Najít a nahradit v editoru (Ctrl+F, Ctrl+H, bez diakritiky, „nahradit vše“ s Ctrl+Z) | střední, opravy opakovaných chyb přepisu | S–M | ne | **1.12 (návrh)** |
| R8 | Zvýraznění hledaných slov v otevřeném článku po kliknutí z hledání, F3 další výskyt | střední | S | ne | **1.12 (návrh)** |
| R9 | Typografie: „Upravit typografii“ (`"…"` → „…“, ` - ` → ` – `, `...` → `…`, nezlomitelné mezery za k s v z o u a i v náhledu) | střední, čeština z výtisků | S | ne | **1.12 (návrh)** |
| R10 | Zápis obsahu čísla najednou: řádky „27 Playboy Interview: Jimmy Carter“ → články bez textu, náhled před uložením; v obsahu čísla štítek přepis / shrnutí / bez textu | vysoká pro obsah 1953–1977 | M | ne | **1.13 (návrh)** |
| R11 | Tisk a PDF článku (`window.print()`, `@media print` jen článek; PDF přes „Tisk do souboru“ v dialogu GTK; záloha: HTML v `~/.cache` otevřené v prohlížeči) | střední | S–M | ne | **1.13 (návrh)** |
| R12 | Rozpracované přepisy v Údržbě: články bez textu nebo s druhem „přepis“ a textem pod 300 slov | nízká–střední | S | ne | **1.13 (návrh)**, volitelně |
| R13 | Wikidata volitelně s potvrzením po polích, offline z mezipaměti | vysoká pro data narození | – | ne | už v 1.10.2 a 1.11.0 |
| R14 | Příprava dalšího roku z katalogu Wikidat | vysoká při chronologickém přidávání | S–M | ne | **1.11.2** (podmíněně) |
| R15 | Rozsah stran článku (strana od–do) | nízká – počet skenů to ukáže | S | **ano** | nedělat teď; jen se spojením s jinou úpravou schématu |

### R6 – jména modelek v textu (podrobněji)

Zápis `[[Jana Ukázková]]` nebo `[[Jana Ukázková|Jana]]` (zobrazený text). `formatMarkdown` dostane volbu
`modelky` (mapa `sjednotit(jméno)` → id z `vsechnyModelky()`); známé jméno = `<button class="link"
data-modelka="id">`, neznámé = obyčejný text s tečkovaným podtržením a v editoru varování. Našeptávač po `[[`
z mezipaměti jmen (stejný jako `seznamModelekClanku`). „Zmínky v článcích“ v profilu = `HledatClanky` podle
`[[jméno` v `texty_fts` (nová vazba `GetZminkyModelky`), bez nové tabulky. Přejmenování modelky: texty se
nepřepisují samy – Údržba nabídne „N článků zmiňuje staré jméno“ s nahrazením po potvrzení. Starší verze
programu ukážou `[[Jméno]]` jako text, export beze změny.

### Navržené nové verze

| Verze | Obsah | Kroky | Závisí na | Pozice |
|---|---|---|---|---|
| 1.12 (návrh) | Texty III – propojení a hledání v textu | R6, R7, R8, R9 | 1.9 | hned po 1.9; když Wikidata čekají na rozhodnutí, jde před 1.10 (čísla zůstanou, změní se pořadí) |
| 1.13 (návrh) | Obsah čísla a tisk | R10, R11, (R12) | 1.8 | kdykoli po 1.8; R10 je vhodné co nejdřív, protože obsah 70. let přibývá denně |

## Konflikty se zásadami

| Bod | Zásada | Stav |
|---|---|---|
| Editor | Rozhodnuto: vlastní lišta nad markdownem, žádná knihovna editoru | dodrženo; WYSIWYG (contenteditable), CodeMirror, Toast UI apod. se nedělají |
| Pravopis (1.9.3) | žádná nová knihovna v programu | systémový slovník přes WebKitGTK, ne knihovna v kódu; cgo volání je nová vazba na API WebKitu – vědomé rozhodnutí |
| Koncept (1.8.0) | `localStorage` jen pro pohodlí | koncept neodeslaného textu je pohodlí, ne data; uložený text je vždy v databázi |
| Wikidata (1.10–1.11) | **Nedělat: „stahování údajů z webu“** | **v rozporu** – vyžaduje rozhodnutí uživatele (upřesnit na „automatické stahování a zápis bez potvrzení“); bez něj se 1.10–1.11 nedělají |
| Příprava roku (1.11.2) | Nedělat: „automatický import celé složky bez výběru“ (obdobně) | jen předvyplněný formulář jedné modelky, žádné hromadné zakládání |
| Fotky z Commons (P18) | Rozhodnuto: fotky jen na Disku | nenabízí se |
| OCR skenů (Tesseract) | žádná zásada přímo, ale velká závislost a slabá kvalita na sazbě časopisů | **nedělat** – přepis z výtisku je přesnější |
| Automatický zápis z webu, parsování Wikipedie | NAVRH-NAPADY → Nedělat | nedělat |

## K vložení do ROADMAP.md

Řádky tabulky verzí (nahradí řádky 1.8–1.11 a přidají návrhy):

```markdown
| 1.8 | Editor I – ochrana textu, lišta, náhled, zkratky | – | 1.7 |
| 1.9 | Editor II – rozhovory, jeden editor všude, sken vedle textu, pravopis | 1.8 | 1.8 |
| 1.10 | Wikidata I – návrh údajů u modelky | – (rozhodnutí) | 1.12 |
| 1.11 | Wikidata II – hromadně v Údržbě, příprava dalšího roku | 1.10 | 1.13 |
| 1.12 (návrh) | Texty III – jména modelek v textu, najít a nahradit, zvýraznění, typografie | 1.9 | – |
| 1.13 (návrh) | Obsah čísla a tisk článku | 1.8 | – |
```

Oddíly:

```markdown
### 1.8 – Editor I: ochrana textu, lišta, náhled, zkratky

**Cíl:** přepis článku bez psaní formátovacích značek zpaměti a bez rizika ztráty textu. Text se dál ukládá
jako markdown (schéma ani export se nemění), takže starší texty fungují beze změny. Zatím okno článku,
ostatní texty v 1.9. Rozbor kroků: [PLAN-1X-TEXTY.md](docs/PLAN-1X-TEXTY.md).

**Rozhodnutí:** vlastní lehký editor nad textovým polem (lišta vkládá značky, vedle živý náhled stávajícím
převodem markdownu) místo editoru „co vidíš, to dostaneš“ z cizí knihovny – žádná nová závislost, žádný
rozdíl mezi náhledem a uloženým textem, funguje se stávajícími zásadami zabezpečení (CSP). Značky se vkládají
přes `insertText`, aby fungovalo Ctrl+Z.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Ochrana rozepsaného textu | Okno článku a okno čísla v `oknaSFormularem` (Esc a Zrušit se zeptají); koncept textu článku každých 5 s v `localStorage`, při dalším otevření nabídka „Obnovit koncept“ | S |
| 2 | Lišta a odkazy | `lib/editor.js` (obalení výběru, předpona řádků, přečíslování, s testy) a `ui/editor.js`; tlačítka tučné, kurzíva, nadpis, odrážky, číslování, citace, odkaz; převod markdownu pozná `[text](https://…)` jako odkaz do prohlížeče | M |
| 3 | Náhled | Psaní / Náhled / Vedle sebe (od 900 px), `formatMarkdown` se stejnými volbami jako v čísle, překreslení po 150 ms, náhled sleduje kurzor | M |
| 4 | Zkratky, celé okno, počet slov | Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+1–3; Enter v odrážce pokračuje, na prázdné ukončí; Tab jen v odrážkách; ⤢ / Ctrl+Shift+F celé okno, Esc nejdřív zmenší; stavový řádek slova, znaky, čtení | S–M |

**Hotovo, když:** článek jde naformátovat bez ručně psaných značek a Ctrl+Z vrátí každé vložení; texty
uložené před 1.8 vypadají v náhledu stejně jako dřív; rozepsaný text se neztratí Esc ani pádem programu.

### 1.9 – Editor II: rozhovory, jeden editor všude, sken a pravopis

**Cíl:** přepis rozhovorů bez psaní značek, stejný editor u všech textů, předloha vedle textu a podtržené překlepy.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Rozhovory a šablony | Šablona podle rubriky na kliknutí (Playboy Interview, 20 otázek, Advisor, Povídka); mluvčí z textu, po odpovědi „Další: PLAYBOY: (Tab)“, Alt+M přepne mluvčího | S–M |
| 2 | Jeden editor všude | Texty alb, poznámky modelek a čísel; malá varianta lišty, stejné zkratky; nápověda a přehled zkratek doplněné | S–M |
| 3 | Sken vedle textu | V celém okně článku panel Předloha se skeny stran (přiblížení, Alt+PageUp/PageDown bez opuštění textu); výpočet stran sdílený s čtečkou; bez připojení „Nenačteno“ | M |
| 4 | Kontrola pravopisu | cgo `webkit_web_context_set_spell_checking_enabled` (cs_CZ, en_US), `EnableDefaultContextMenu` jen pro návrhy v textových polích, `spellcheck` po polích; `instalovat.sh` a README: `hunspell-cs`, `hunspell-en`; ověřit na Fedoře | S–M |

**Hotovo, když:** rozhovor o deseti otázkách jde přepsat bez jediné ručně psané značky; články, alba
i poznámky mají stejný editor a zkratky; čtyřstránkový článek jde přepsat se skenem vedle bez myši;
překlep je podtržený a pravé tlačítko nabídne opravu.

### 1.10 – Wikidata I: návrh údajů u modelky

**Čeká na rozhodnutí uživatele:** odporuje bodu „stahování údajů z webu“ v oddílu Nedělat (návrh: upřesnit na
„automatické stahování a zápis údajů z webu bez potvrzení“). Bez rozhodnutí se 1.10–1.11 vynechají.

**Cíl:** chybějící údaje modelky doplnit z Wikidat (CC0) jen na kliknutí a s potvrzením každého údaje.
Bez změny schématu i exportu: původ = odkaz na položku Wikidat v Odkazech, odmítnuté hodnoty v `nastaveni`.
Před prvním krokem prototyp mimo hlavní větev: pokrytí 40 modelek 1953–1977, QID ocenění, odpovědi do
`testdata/wikidata/`; pod 50 % pokrytí dat narození se nepokračuje.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Klient a porovnání | `wikidata.go`: vyměnitelná `stahnoutWikidata`, `User-Agent` s verzí, `maxlag`, `Retry-After`, mezipaměť v `~/.cache/playboy-app/wikidata/` (30 dní), převod přesnosti data, jednotek a státu; ⋯ → „Porovnat s Wikidaty…“ u modelky s odkazem na Wikipedii, zatím jen ke čtení | M |
| 2 | Spárování | Kandidáti (`wbsearchentities`), skóre (měsíc centerfoldu, datum narození, jméno, popis), rozporné datum vylučuje; jistá / možná (výběr osoby) / žádná (vložit QID) | M |
| 3 | Převzetí po polích | Zaškrtnutí po polích (prázdné ano, rozdíl ne s ⚠, mimo rozsah Kontroly ne), uložení přes `UpdateModelka` s Vrátit, řádek Wikidat do Odkazů, odmítnuté se znovu nenabízí; i v okně „Doplnit modelku“ | M |

**Hotovo, když:** u 20 zkušebních modelek návrh odpovídá Wikipedii, nic se neuloží bez potvrzení, bez
připojení volba ohlásí výpadek a nic nezmění.

### 1.11 – Wikidata II: hromadně a pro další rok

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Katalog playmate | Jeden dotaz SPARQL na všechny Playmate měsíce a roku s datem, uložený v mezipaměti (obnova na kliknutí); párování podle měsíce centerfoldu; s katalogem fungují návrhy i offline | S–M |
| 2 | Filtr „Z Wikidat“ | „Zjistit návrhy pro N modelek bez data narození“, postup s pozastavením (nejvýš 1 dotaz/s), fronta návrhů, „Projít…“ a „Přijmout vše bez ⚠“ (jen jisté shody a prázdná pole), Vrátit dávky; skupina „Rozdíly“ jen k posouzení | M |
| 3 | Příprava dalšího roku | U měsíce bez centerfoldu v kalendáři a ročníku „Podle Wikidat: jméno“ → formulář nové modelky s předvyplněným jménem, datem narození a vydáním; uloží se jen tlačítkem Uložit | S–M |

**Hotovo, když:** dávka 100 modelek bez data narození doběhne bez chyby 429 a přijetí návrhů jde vrátit;
u roku 1978 kalendář ukáže jména pro prázdné měsíce a nic se nezaloží bez formuláře.

### 1.12 (návrh) – Texty III: propojení a hledání v textu

**Cíl:** články propojené s profily a pohodlné opravy přepisů. Bez změny schématu i exportu (vše v textu).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Jména modelek v textu | `[[Jméno]]` a `[[Jméno\|text]]` jako odkaz na profil (volba `modelky` ve `formatMarkdown`), našeptávač po `[[`, neznámé jméno varuje; v profilu „Zmínky v článcích“ přes `texty_fts` | M |
| 2 | Najít a nahradit | Ctrl+F / Ctrl+H v editoru, bez ohledu na diakritiku a velikost, „Nahradit vše“ vratné Ctrl+Z | S–M |
| 3 | Zvýraznění z hledání | Článek otevřený z hledání zvýrazní hledaná slova (`zvyraznit`), F3 další výskyt, Esc zruší | S |
| 4 | Typografie | „Upravit typografii“: české uvozovky, pomlčka, tři tečky; v náhledu a čísle nezlomitelné mezery za jednopísmennými předložkami | S |

**Hotovo, když:** jméno modelky v rozhovoru otevře její profil a profil ukáže články, které ji zmiňují;
opakovaná chyba přepisu jde opravit v celém textu jedním nahrazením a vrátit.

### 1.13 (návrh) – Obsah čísla a tisk

**Cíl:** rychle zapsat obsah celého čísla a článek vytisknout nebo uložit jako PDF. Bez změny schématu i exportu.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Zápis obsahu najednou | Na stránce čísla „Zapsat obsah…“: řádky „27 Playboy Interview: Jimmy Carter“ → náhled → články bez textu; v obsahu čísla štítek přepis / shrnutí / bez textu | M |
| 2 | Tisk a PDF | „Vytisknout článek…“: `@media print` jen s článkem, dialog GTK (PDF přes „Tisk do souboru“); když tisk ve WebKitGTK nefunguje, HTML do `~/.cache` a otevření v prohlížeči | S–M |
| 3 | Rozpracované přepisy (volitelně) | Filtr Údržby: články bez textu a přepisy pod 300 slov | S |

**Hotovo, když:** obsah čísla s deseti články jde zapsat jedním vložením; článek jde uložit jako PDF se
stejnou sazbou jako v programu.
```

Do oddílu „Rozhodnuto“ po potvrzení:

```markdown
- Editor textů (1.8–1.9): vlastní lišta nad markdownem s náhledem, žádná knihovna editoru; pravopis ze systémového
  slovníku přes WebKitGTK; koncept rozepsaného článku v úložišti prohlížeče (jen pohodlí).
```
