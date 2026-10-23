# Plán 1.1–1.4: Google Disk, náhledy na disku, rychlé drobnosti

Stav k 23. 10. 2026 (verze 0.99.x, schéma úprava č. 11, export verze 7). Rozpracování verzí 1.1–1.4 z `ROADMAP.md`
na dílčí kroky (PATCH vydání) a návrh rozšíření. Nic z toho není rozhodnuté; po potvrzení se oddíly z konce
dokumentu přenesou do `ROADMAP.md`. Čísla verzí jsou podle revize 23. 10. 2026 (1.3 = dřívější 1.5,
1.4 = dřívější 1.3).

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export.

## Jak uživatel sbírku plní (z čeho plán vychází)

- ~400 modelek, desítky nových denně, chronologicky po číslech (teď rok 1977): modelka → centerfold → případně
  pictorial a cover, další číslo. Okno alba je tedy nejpoužívanější okno programu.
- Hodnotí každou modelku, fotky jen ty, které se líbí → ohodnocené fotky a titulní fotky jsou to, co se
  prohlíží nejčastěji (priorita náhledů v 1.3).
- Fedora, WebKitGTK; fotky jsou na vlastním Disku, odkazy se dnes kopírují ručně z prohlížeče.

## Výchozí stav v kódu

| Co | Kde | Pro plán |
|---|---|---|
| Rozbor odkazů | `parseDriveIDs` (`app.go`): `file/d/`, `id=`, `/d/`, holá ID; odstraní opakování v jednom vložení | Výběr z Disku jen vrátí odkazy do stejného pole → zbytek ukládání beze změny |
| Odkaz na složku | `jeOdkazNaSlozku` (`navigace.js`) hlášku „složku program nerozbalí“ | V 1.1.2 nahradí nabídka „Vybrat složku z Disku…“ |
| Vložení fotek | `AddBulkPhotos` (`app.go`): kontrola duplicity jen v tomtéž albu, dotaz po jednom ID nad pohledem `fotografie`, `overitSoubory` (8 souběžně, `w64`), `INSERT` po jednom bez transakce | Duplicity napříč sbírkou (1.4.0) jedním dotazem `IN (…)`; zápis v transakci |
| Okno alba | `formular-alba.js` (`otevritAlbumModal`), odeslání v `ulozeni.js` (`addAlbumForm.onsubmit`), šablona v `sablona.js` (`#inputBulkLinks`, „Uložit a přidat další“ drží modelku, typ, fotografa a vydání) | Tlačítko „Vybrat z Disku“, náhled vložených, klávesy |
| Další místa s odkazy | cover (`cover.js`, `AddCover`/`UpdateCover`), titulní fotka (`#inputDriveID`, `OveritOdkaz`), skeny článků (`#inputClanekSkeny`) | 1.2.0 |
| Adresa obrázků | `vychoziSablonaObrazku = https://lh3.googleusercontent.com/d/{id}={velikost}`, `adresaObrazku`, `SetSablonaObrazku` (ověří na jedné dostupné fotce) | Záložní šablona a server náhledů (1.3) |
| Velikosti | `obrazky.js`: `w400` dlaždice a karty, `w600` malý plakát, `w800` titulní, `w1200` velký plakát, `s0` prohlížeč; `obrazek()` v `format.js` jen dosadí `{velikost}` | Ukládat na disk jen `w400` a `w600` |
| Postupné načítání | `nacitatPostupne` (IntersectionObserver, ruší odrolované požadavky), zástupný obrázek „Nenačteno“, opakování po `online` | Server náhledů musí rušit stažení se zrušeným požadavkem (`r.Context()`) |
| Mezipaměť | `VymazatMezipamet` maže `~/.cache/<program>/WebKitCache` | Okno „Náhledy“ v 1.3.1 ji doplní, nenahradí |
| Kontrola souborů | `ZkontrolovatSoubory`/`ZkontrolovatDavku` (300 denně), `overeno`, `nedostupne_od`; Údržba `kontrolovatDvojiceFotek` (stejné ID ve dvou albech jedné modelky) | 1.2.2 rozliší smazané od nenasdílených; 1.4.0 hlídá napříč modelkami |
| CSP | `frontend/index.html`: `script-src 'self'; object-src 'none'; base-uri 'none'` (obrázky neomezuje) | S náhledy přes vlastní cestu jde přidat `img-src` (1.3.2) |
| Server aplikace | `main.go`: `assetserver.Options{Assets: assets}` (Wails 2.16) | `Handler` pro cestu `/nahled/…` – požadavky, které nejsou v `frontend/dist`, dostane Go |
| Zámek | `nastaveni.go` (`MaZamek`, `Odemknout`, PBKDF2), `sprava.js` (`odemknoutPriStartu`, ⋯ → Zamknout = `location.reload()`) | Automatické zamčení nesmí přenačíst okno s rozepsaným formulářem |
| Ročník | `vykreslitRocnik` (`vydani.js`), stránka čísla `otevritVydani`; šipky na sousední ročník ani číslo nejsou | 1.4.3 |
| Zmrazení | `TestZmrazeniAlfy`: 11 úprav schématu, export 7 | Nový index = nová úprava schématu → v 1.1–1.4 žádný (viz 1.4.0) |

---

## 1.1 – Google Disk I: přihlášení a výběr do alba

**Cíl beze změny:** fotky do alba výběrem z Disku. Zobrazování dál přes sdílené odkazy bez přihlášení.
Bez změny schématu i exportu; token v `~/.config/playboy-app/google.json` (0600), u vývojového sestavení
vlastní soubor (`google-dev.json`), aby se sestavení nepřepisovala.

### Krok 0 – prototyp (nevydává se)

Samostatný program v `docs/prototyp-disk/` nebo větvi; výsledek se zapíše do `PLAN.md` a do „Rozhodnuto“.

Ověřit na Fedoře (Firefox i Chrome):

1. Picker na stránce z `http://127.0.0.1:<pevný port>` (např. 47615; povolený původ JavaScriptu u klíče API).
2. OAuth pro desktop s PKCE na náhodném portu loopbacku, rozsah `drive.file`.
3. `setAppId(<číslo projektu>)` – bez něj `drive.file` k vybraným souborům přístup nedá.
4. Výběr 50+ souborů najednou (Ctrl+A ve složce), vrácená pole: `id`, `name`, `mimeType`, `parentId`.
5. **Výběr složky** (`DocsView.setSelectFolderEnabled(true)`): dá `drive.file` přístup i k souborům v ní
   (`files.list` s `'<id>' in parents`)? Pokud ne, platí jen cesta „otevřít složku v Pickeru a Ctrl+A“.
6. `permissions.create` (čtenář, kdokoli) na vybraném souboru – pro 1.2.1.
7. Obrazovka souhlasu v produkčním režimu bez ověření Googlem a token platný i po 7 dnech.

**Hotovo, když:** všech 7 bodů má zapsaný výsledek; při neúspěchu bodu 1–3 se 1.1 zastaví a rozhodne znovu
(varianta `drive.readonly` má v „Rozhodnuto“ výhrady).

### 1.1.0 – Nastavení projektu a přihlášení (M–L)

- **Go:** nový `google.go` – načtení a uložení `google.json` (ID klienta, klíč API, číslo projektu, obnovovací
  token), OAuth s PKCE a dočasným serverem na `127.0.0.1:0`, obnovení přístupového tokenu, odhlášení
  (`oauth2.googleapis.com/revoke` + smazání tokenu). Knihovna `golang.org/x/oauth2` (nová závislost, malá,
  od týmu Go) nebo vlastních ~150 řádků – doporučení: knihovna.
- Vazby: `GoogleStav() StavGoogle` (nastaveno, přihlášen, e-mail účtu), `GoogleNastavit(klient, klic, projekt) string`,
  `GooglePrihlasit() string`, `GoogleOdhlasit() bool`. Síťová funkce vyměnitelná proměnnou jako `overitSoubor`.
- **Rozhraní:** ⋯ → Google Disk… (nové okno v `sablona.js`, obsluha `app/disk.js`):

```
Google Disk
  Stav: přihlášen jako jmeno@gmail.com                [Odhlásit]
  ID klienta  [ 1234-….apps.googleusercontent.com ]
  Klíč API    [ AIza…                              ]
  Číslo projektu [ 1234567890 ]                [Návod v README]
  Prohlížení sbírky přihlášení nepotřebuje.     [Zavřít] [Přihlásit]
```

- **README:** oddíl „Google Disk v programu“: projekt, zapnout Drive API a Picker API, obrazovka souhlasu
  (externí, produkční), ID klienta typu Desktop, klíč API omezený na Picker API a původ `http://127.0.0.1:47615`.
- **Testy:** uložení a načtení `google.json` s právy 0600; token se neobjeví v exportu, záloze ani v `nastaveni`
  (test prohledá výstupy na obnovovací token); obnovení tokenu proti falešnému serveru (`httptest`); odhlášení
  bez sítě smaže token místně a ohlásí, že u Googlu zůstal platný.
- **Rizika:** port pro Picker obsazený → hláška s návodem; firewall Fedory loopback neblokuje.
- **Hotovo, když:** podle README jde na čistém účtu založit projekt a přihlásit se; po restartu je program
  přihlášený; odhlášení token zruší.
- **Ověření na Fedoře:** postup z README, `ls -l ~/.config/playboy-app/google.json` ukáže `-rw-------`,
  export YAML neobsahuje `refresh_token`.

### 1.1.1 – Vybrat z Disku v okně alba (M)

- **Go:** `vyber_disku.go` – na `127.0.0.1:47615` stránka s Pickerem (vložená přes `embed`, jednorázový klíč
  v adrese, přístupový token předaný jen této stránce), výsledek přijde POSTem zpět; `VybratZDisku() VysledekVyberu`
  čeká nejvýš 10 minut, `ZrusitVyberDisku()`. Výsledek: seznam `{id, nazev, typ}`, jen `image/*`.
- **Pořadí:** soubory seřazené přirozeně podle názvu (`IMG_2`, `IMG_10`) – pořadí stran v albu odpovídá Disku,
  ne pořadí klikání. Názvy se nikam neukládají.
- **Rozhraní:** v okně alba vedle popisku pole odkazů tlačítko „Vybrat z Disku…“ (bez nastavení vede do
  ⋯ → Google Disk). Během čekání v okně řádek „Vyber fotky v prohlížeči… [Zrušit]“; vrácené odkazy se přidají
  na konec pole (každý na řádek) a ukáže se „Vybráno 24 fotek“. Uložení jde dál přes `AddBulkPhotos`.
- **Testy:** zpracování odpovědi Pickeru (filtr typů, řazení názvů, prázdný výběr, zrušení); stránka bez platného
  klíče vrací 403; souběžný druhý výběr zruší první.
- **Hotovo, když:** album z 24 fotek jde přidat jedním výběrem a pořadí odpovídá názvům souborů.
- **Ověření na Fedoře:** v okně alba „Vybrat z Disku…“ → otevře se výchozí prohlížeč → výběr → okno programu
  ukáže odkazy; zavření karty prohlížeče bez výběru program po „Zrušit“ uvolní.

### 1.1.2 – Celá složka a velké výběry (S–M)

- Podle výsledku prototypu (bod 5): buď „Vybrat složku“ = všechny obrázky ve složce (`files.list` po stránkách),
  nebo nápověda v Pickeru „otevři složku a stiskni Ctrl+A“. Vložený odkaz na složku (`jeOdkazNaSlozku`)
  místo hlášky nabídne „Vybrat tuto složku z Disku…“ (Picker otevřený v ní, `setParent`).
- **Výkon `AddBulkPhotos`:** kontrola duplicit v albu jedním dotazem a zápis v jedné transakci (dnes `INSERT`
  po jednom); 300 fotek pod 1 s mimo ověření sítí.
- Výběr nad 300 souborů se před vložením potvrdí („Vybráno 412 fotek ze složky Playmates 1977. Vložit?“) – žádný
  import celé složky bez potvrzení (Nedělat).
- **Testy:** `AddBulkPhotos` s 300 ID v transakci (při chybě uprostřed se nevloží nic, výsledek to ohlásí);
  stránkování `files.list` proti `httptest`.
- **Hotovo, když:** album z 50 fotek ze složky jde přidat jedním výběrem; odhlášený program dál normálně
  zobrazuje celou sbírku; token není v databázi, zálohách ani exportu.

---

## 1.2 – Google Disk II: výběr všude, nasdílení, oprava odkazů

**Změna proti ROADMAP:** záložní adresa obrázků (dřívější krok 4) se přesouvá do 1.3.2 – server náhledů ji
použije sám při chybě `lh3`, bez ručního přepínání. Místo ní přibývá **Vyměnit soubor** (oprava nefunkčního
odkazu), který s přihlášením dává největší užitek.

### 1.2.0 – Výběr na dalších místech (S–M)

- Společná funkce v `app/disk.js`: `vybratZDisku({ jedna: true|false })` → odkazy; tlačítko „Z Disku…“ u pole
  titulní fotky (`#inputDriveID`, jeden soubor), v okně coveru (`cover.js`), u skenů článku (`#inputClanekSkeny`,
  více souborů) a v nabídce alba „Přidat fotky z Disku…“ (otevře okno alba v režimu úpravy a rovnou Picker).
- Vkládání odkazů zůstává jako druhá cesta (funguje bez přihlášení); tlačítka bez nastavení Google nejsou vidět.
- **Hotovo, když:** cover, titulní fotka i skeny jdou vybrat z Disku; bez přihlášení vypadají okna jako dnes.

### 1.2.1 – Nasdílení (S)

- `StavSdileni(ids) []bool` (`files.get` s `permissions` nebo `permissionIds` – jen u souborů z výběru) a
  `Nasdilet(ids) VysledekSdileni` (`permissions.create`, role `reader`, typ `anyone`, 4 souběžně, pauza při 429).
- V okně alba po výběru řádek se zaškrtnutím (nikdy potichu):

```
⚠ 6 z 24 fotek není sdílených „kdokoli s odkazem“ – bez přihlášení se nezobrazí.
[x] Nasdílet 6 souborů při uložení
```

- **Testy:** falešné API: sdílené, nesdílené, odmítnuté (soubor patří jinému účtu → hláška, uloží se jako dnes).
- **Hotovo, když:** nenasdílené fotky se po zaškrtnutí nasdílí a zobrazí bez přihlášení.

### 1.2.2 – Kontrola s přihlášením a Vyměnit soubor (M)

- `ZkontrolovatSoubory` u nedostupných souborů zkusí `files.get` (jde jen u souborů, které program kdy vybral):
  `trashed` → „v koši na Disku“, 404 → „smazaný“, bez oprávnění `anyone` → „nenasdílený“ s tlačítkem Nasdílet.
  Soubory přidané dřív odkazem zůstávají „nedostupné“ jako dnes.
- **Vyměnit soubor:** v nabídce nenačtené fotky a u nálezu v Údržbě „Vyměnit soubor z Disku…“ → Picker s jedním
  souborem → `UpdateFotkaSoubor(id, odkaz)` přepíše jen `drive_file_id` (jako dnes `UpdateCover`), hodnocení,
  pořadí, otočení a album zůstávají; `overeno` se nastaví, `nedostupne_od` smaže. Funguje i vložením odkazu bez
  přihlášení. Před změnou záloha není potřeba (Vrátit jako u fotek).
- **Testy:** výměna zachová hodnocení a pořadí; výměna za ID, které v albu už je, se odmítne; Vrátit obnoví staré ID.
- **Hotovo, když:** nedostupná fotka vybraná dřív přes Picker se ohlásí jako „smazaná“ nebo „nenasdílená“;
  nefunkční fotka jde nahradit novým souborem bez ztráty hodnocení.
- **Ověření na Fedoře:** na Disku jednu fotku přesunout do koše, jedné zrušit sdílení → Údržba → Zkontrolovat
  soubory rozliší oba případy; Vyměnit soubor vrátí fotku s původními srdíčky.

---

## 1.3 – Náhledy na disku

**Cíl beze změny:** karty a dlaždice okamžitě a i bez internetu. Jen malé náhledy (`w400`, `w600`); `w800`,
`w1200` a `s0` se dál stahují z Disku. Bez změny schématu i exportu.

**Rozhodnutí k potvrzení:** jedna cesta pro všechny velikosti (šablona obrázků `/nahled/{id}/{velikost}`,
velké velikosti Go jen propustí bez uložení) – **doporučeno**, protože pak jde záložní adresa, rušení požadavků
a CSP `img-src` řešit na jednom místě. Druhá možnost: přepis jen malých velikostí v `obrazek()` – méně kódu,
ale rozhraní musí znát ID souboru i u titulních fotek.

### 1.3.0 – Server náhledů (M)

- **Go:** `nahledy.go`, `http.Handler` v `assetserver.Options.Handler` (`main.go`); cesta
  `/nahled/{id}/{velikost}`, ID ověřené vzorem `vzorHolehoID`, velikost ze seznamu. Soubor
  `~/.cache/playboy-app/nahledy/<2 znaky ID>/<id>_w400.jpg` (u vývojového sestavení `playboy-app-dev`);
  zápis přes dočasný soubor a přejmenování (žádný napůl zapsaný náhled). Uloží se jen odpověď `200 image/*`.
- Souběh stahování nejvýš 8 (jako `overitSoubory`), stejný požadavek dvakrát = jedno stažení; zrušený požadavek
  (`r.Context()`) zruší stažení – `nacitatPostupne` tak dál funguje při rychlém rolování.
- Hlavičky `Cache-Control: max-age=31536000, immutable` u náhledů z disku, aby je WebKit neukládal podruhé
  zbytečně dlouho do své mezipaměti (ověřit, že WebKitGTK u vlastního schématu `wails://` respektuje).
- `GetSablonaObrazku` dál vrací šablonu pro kontrolu souborů (`overitSouborNaDisku` jde přímo na Disk, ne přes
  mezipaměť – kontrola musí vidět skutečný stav).
- **Testy:** handler proti `httptest` serveru místo Disku: první požadavek stáhne, druhý čte z disku bez sítě;
  chyba Disku (403, HTML místo obrázku) se neuloží a vrátí 502; neplatné ID 400; souběžné stejné požadavky =
  1 stažení; zrušení požadavku.
- **Riziko:** Wails na Linuxu podává vlastní schéma přes WebKit – ověřit propustnost (64 souběžných dlaždic)
  a že `Handler` dostává i požadavky z `<img>` ve vývojovém režimu (`wails dev`).
- **Hotovo, když:** po prvním projití profilu se jeho dlaždice při dalším otevření zobrazí bez sítě.
- **Ověření na Fedoře:** projít profil, vypnout Wi-Fi, restartovat program → dlaždice profilu i karty galerie
  jsou vidět; velká fotka v prohlížeči ukáže „Nenačteno“.

### 1.3.1 – Limit a správa náhledů (S–M)

- Velikost mezipaměti se spočítá při startu na pozadí (`filepath.WalkDir`, 50 000 souborů ≈ 0,1–0,3 s) a pak
  se průběžně přičítá. Nad limitem se mažou nejdéle nepoužité: čas použití = `mtime`, který se při čtení obnoví
  nejvýš jednou denně (`os.Chtimes`) – nezávisí na `relatime`/`noatime` připojení disku.
- Úklid při startu (na pozadí, po otevření okna): náhledy ID, která už ve sbírce nejsou (smazané fotky).
- Okno ⋯ → Náhledy… (nahradí samotnou položku „Vymazat mezipaměť“):

```
Náhledy na disku
  Uloženo: 742 MB (18 412 náhledů) z limitu [ 1 GB ▾ ]   (500 MB / 1 / 2 / 5 GB)
  Celá sbírka v náhledech by zabrala asi 1,1 GB.
  Mezipaměť prohlížeče: 120 MB
  [Vymazat náhledy]  [Vymazat mezipaměť prohlížeče]            [Zavřít]
```

- Limit v `nastaveni` (`nahledy_limit_mb`) – není v exportu, je v záloze; bez změny schématu.
- **Testy:** úklid nad limitem smaže nejstarší podle `mtime`; náhled smazané fotky zmizí; vymazání vrátí
  uvolněné bajty.
- **Hotovo, když:** mezipaměť nepřekročí limit; „Vymazat náhledy“ ukáže a uvolní místo.

### 1.3.2 – Záložní adresa a chování bez připojení (S)

- V serveru náhledů: když `lh3` vrátí chybu (ne výpadek sítě), zkusí se záložní šablona
  `https://drive.google.com/thumbnail?id={id}&sz={velikost}` (`sz` přijímá stejný zápis, např. `sz=w400`); funguje
  bez přihlášení u sdílených souborů. Kolikrát pomohla záloha, ukáže okno Náhledy; ⋯ → Adresa obrázků nabídne
  záložní šablonu jako předvolbu (jedním klikem, s ověřením přes `SetSablonaObrazku`).
- Bez připojení náhled, který na disku není, vrátí rychle 503 (žádné čekání 20 s); rozhraní ho jako dnes nahradí
  „Nenačteno“ a po `online` načte znovu (`obrazky.js` beze změny).
- CSP: `img-src 'self' data: https://lh3.googleusercontent.com https://drive.google.com` (nebo jen `'self' data:`,
  když jdou všechny velikosti přes server). Ověřit na Fedoře: okno není prázdné, prohlížeč fotek funguje.
- **Hotovo, když:** přepnutí na záložní adresu zobrazí sbírku stejně; bez internetu se nic nezasekne.

### 1.3.3 – Náhledy předem a měření (M)

- ⋯ → Náhledy → „Stáhnout chybějící náhledy“: na pozadí, 4 souběžně, pauza při výpadku a 429, pokračuje po
  restartu (pořadí podle ID je samo o sobě záložkou), stav v okně a zastavení. Pořadí podle toho, co se prohlíží:
  titulní fotky modelek → plakáty centerfoldů a coverů (`w600`) → ohodnocené fotky → ostatní dlaždice. Nad limitem
  se zastaví s hláškou, nikdy nemaže, aby uvolnilo místo pro předem stažené.
- Volitelně (zaškrtávátko, výchozí vypnuto): po přidání alba stáhnout jeho náhledy hned – album je pak offline
  i bez prohlížení.
- **Měření:** zátěžová sbírka (2 000 modelek, 64 000 fotek) se serverem náhledů proti místnímu falešnému Disku
  (`vykon_test.go`): galerie, profil s 500 fotkami, Nejlepší; cíl: pohled pod 0,5 s, rolování bez prázdných
  karet z mezipaměti, start programu se nezpomalí o víc než 50 ms (úklid až po otevření okna).
- **Hotovo, když:** po „Stáhnout chybějící náhledy“ jsou karty a dlaždice celé sbírky vidět bez internetu;
  měření splní cíle.
- **Ověření na Fedoře:** stáhnout náhledy, vypnout síť, projít Modelky, Stěnu, Nejlepší a dva profily.

---

## 1.4 – Rychlé drobnosti

**Cíl:** malé věci z každodenní práce, každá jako samostatná verze. Navíc proti ROADMAP: náhled vložených fotek
v okně alba (1.4.1) a sousední čísla vedle ročníků (1.4.3).

### 1.4.0 – Upozornění na duplicitu (S)

- **Go:** `NajitDuplicity(rawLinks) []Duplicita` – jeden dotaz `SELECT … FROM fotky f JOIN alba al … WHERE
  f.drive_file_id IN (…)` (64 000 fotek bez indexu ≈ 5–15 ms; ověřit měřením). Vrací modelku, album, typ,
  vydání; titulní fotky modelek (`drive_cover_id`) také.
- **Index na `fotky(drive_file_id)` teď ne** – nový index = úprava schématu č. 12, kterou plánuje 1.5; přidat ho
  tam, pokud měření ukáže potřebu.
- **Rozhraní:** při Uložit v okně alba, pokud jsou duplicity:

```
3 fotky už ve sbírce jsou
  • Debra Jo Fondren – Centerfold Září 1977 (2 fotky)
  • Patti McGuire – Pictorial „Playmate of the Year“ (1 fotka)
[Vynechat je]  [Přidat i tak]                     [Zpět k úpravě]
```

  Stejné ID dvakrát v jednom vložení se sloučí už dnes (`parseDriveIDs`); stejné album = „už uložené“ jako dnes.
- **Testy:** duplicita u jiné modelky, v jiném albu téže modelky, v titulní fotce; „Vynechat“ vloží jen nové.
- **Hotovo, když:** vložení odkazu na fotku, která už ve sbírce je, vždy upozorní.

### 1.4.1 – Náhled vložených fotek v okně alba (S–M) – rozšíření

- Pod polem odkazů pás malých náhledů (`w200` přes server náhledů z 1.3, jinak přímo `lh3`) – obnoví se 300 ms
  po vložení. Každá dlaždice nese stav: ✓, „už ve sbírce“ (z 1.4.0), „nenačte se“ (`OveritOdkazy` = paralelní
  `overitSoubory`), ✕ odebere odkaz z pole. Uživatel před uložením vidí, že vložil správné číslo.

```
Odkazy z Disku  [ … 12 odkazů … ]                 [Vybrat z Disku…]
[▢✓][▢✓][▢✓][▢ už u D. J. Fondren][▢ ✕ nenačte se][▢✓] …   12 fotek, 1 duplicita, 1 nefunkční
```

- Závisí jen volně na 1.3 (bez něj jde náhled rovnou z Disku). Pořadí dlaždic = pořadí uložení.
- **Hotovo, když:** po vložení 12 odkazů je do 2 s vidět 12 náhledů se stavem; ✕ odkaz z pole odebere.

### 1.4.2 – Automatické zamčení (S)

- Volba v okně hesla: zamknout po 5 / 15 / 30 minutách nečinnosti nebo nikdy (výchozí nikdy); `nastaveni`
  (`zamek_po_minutach`), načte se s `MaZamek`. Nečinnost = žádná klávesa, klik, pohyb kolečka; časovač
  v `sprava.js`.
- **Bez `location.reload()`:** zamčení použije překryv `lockScreen` a třídu `zamceno` jako při startu, takže
  rozepsané okno alba zůstane po odemčení otevřené; prohlížeč fotek se zavře. Ruční ⋯ → Zamknout se sjednotí
  se stejnou cestou.
- Rozšíření (volitelné): zamknout i při minimalizaci okna (`visibilitychange`).
- **Testy:** časovač (falešné hodiny v JS testu, pokud jsou; jinak ruční scénář); po odemčení zůstane hodnota
  rozepsaného pole.
- **Hotovo, když:** okno se samo zamkne po nastavené době a rozepsaný formulář po odemčení nezmizí.
- **Ověření na Fedoře:** nastavit 5 minut, rozepsat album, počkat → zámek → odemknout → text v poli je.

### 1.4.3 – Listování ročníky a čísly (S)

- Na stránce ročníku v panelu `‹ 1976 · 1978 ›` (předchozí a další rok téže edice, který má ve sbírce aspoň
  jedno číslo nebo patří do měsíční řady `RADY_EDIC`), klávesy `[` a `]`.
- Rozšíření: na stránce čísla stejné šipky na předchozí a další číslo edice (přeskočí `NEVYSLA_CISLA`,
  speciály až za prosincem), klávesy `[` a `]`; u chybějícího čísla otevře prázdnou stránku s „Přidat
  centerfold“. Hodí se k chronologickému plnění.
- Přehled zkratek (`zkratky.js`) doplnit; klávesy nefungují v polích a v otevřeném okně.
- **Hotovo, když:** ročníky i čísla jdou listovat šipkami i klávesami a Zpět vrací na předchozí stránku.

---

## Rozšíření

| Rozšíření | Užitek | Prac. | Schéma | Kam |
|---|---|---|---|---|
| Pořadí podle názvu souboru z Pickeru | vysoký – strany alba ve správném pořadí bez přeskládání | S | ne | 1.1.1 |
| Vybrat složku z vloženého odkazu na složku | střední | S | ne | 1.1.2 |
| Hromadný zápis v transakci (`AddBulkPhotos`) | výkon u velkých alb | S | ne | 1.1.2 |
| Vyměnit soubor (oprava nefunkčního odkazu) | vysoký – nefunkční fotka bez ztráty hodnocení | S–M | ne | 1.2.2 |
| Automatická záložní adresa v serveru náhledů | odolnost, když `lh3` přestane fungovat | S | ne | 1.3.2 (z 1.2) |
| CSP `img-src` | zabezpečení | S | ne | 1.3.2 |
| Stažení náhledů předem s prioritou (titulní, plakáty, ohodnocené) | vysoký – celá sbírka offline | M | ne | 1.3.3 |
| Volba limitu a odhad velikosti celé sbírky | střední | S | ne | 1.3.1 |
| Náhled vložených fotek v okně alba | vysoký – kontrola před uložením | S–M | ne | 1.4.1 |
| Sousední čísla `[` `]` | střední | S | ne | 1.4.3 |
| Zámek bez přenačtení okna | nutné pro auto-zámek | S | ne | 1.4.2 |
| Klávesy v okně alba (Ctrl+Enter, Ctrl+Shift+Enter, Alt+D) | vysoký při desítkách alb denně | S | ne | nová verze A |
| „Uložit a přidat další číslo“ (posun na další měsíc) | vysoký pro chronologické plnění | S | ne | nová verze A |
| Z formuláře modelky rovnou centerfold („Uložit a přidat centerfold“, další chybějící číslo) | vysoký | S–M | ne | nová verze A |
| Odkazy ze schránky a přetažením | střední | S | ne | nová verze A |
| Index na `fotky(drive_file_id)` | výkon kontroly duplicit nad 50 000 fotek | S | **ano** (úprava č. 12) | 1.5 krok 2 spolu s titulní fotkou alba, jen když měření ukáže potřebu |
| Hlídání složky na Disku a automatický import | – | – | – | **ne – Nedělat** („automatický import celé složky bez výběru“) |
| Vlastní prohlížeč Disku v programu | – | M–L | – | **ne** – potřebuje `drive.readonly` (Rozhodnuto: `drive.file`) |
| Zobrazování přes API s přihlášením (i pro nenasdílené) | – | – | – | **ne – Nedělat** |
| Místní kopie velkých fotek / offline prohlížeč v plné velikosti | – | – | – | **ne – Nedělat** (jen malé náhledy) |

### Nová verze A – 1.12+ (návrh): Rychlé přidávání

**Zařazení:** hned za 1.4 (před Kvalitu dat); nezávisí na 1.1–1.3, ale s 1.1 dává smysl Alt+D.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Klávesy v okně alba | Ctrl+Enter = Uložit, Ctrl+Shift+Enter = Uložit a přidat další, Alt+D = Vybrat z Disku, Alt+F = fotograf; po vložení odkazů fokus na Uložit; v přehledu zkratek | S |
| 2 | Další číslo | „Uložit a přidat další“ u centerfoldu posune měsíc na další číslo edice (přeskočí `NEVYSLA_CISLA`, po prosinci leden dalšího roku) a vyprázdní modelku; ve formuláři nové modelky „Uložit a přidat centerfold“ otevře okno alba s modelkou a prvním chybějícím číslem po posledním centerfoldu ve sbírce (z dat kalendáře) | S–M |
| 3 | Schránka a přetažení | Při otevření okna alba nabídka „Vložit 12 odkazů ze schránky“, když schránka (`runtime.ClipboardGetText`) obsahuje odkazy na Disk, které ve sbírce nejsou – jen nabídka, nic se nevloží samo; přetažení odkazů z prohlížeče na profil otevře okno alba s nimi, na otevřené okno je přidá (WebKitGTK `text/uri-list`, ověřit s Wails `DragAndDrop`) | S |

**Hotovo, když:** centerfoldy dvanácti čísel roku 1977 jdou přidat bez myši (kromě výběru fotek); přetažený
odkaz z Firefoxu skončí v poli odkazů; obsah schránky se nikdy nevloží bez kliknutí.

## Rozpory se zásadami

- **Žádný přímý rozpor** v doporučených krocích. Hraniční body:
  - Výběr celé složky (1.1.2) je výběr uživatele s potvrzením, ne automatický import – v souladu s Nedělat,
    pokud se nikdy nespustí bez kliknutí a výběr nad 300 souborů se potvrdí.
  - Kontrola s přihlášením (1.2.2) volá API jen pro metadata souborů z výběru, ne pro zobrazování.
  - Stažení náhledů předem (1.3.3) ukládá jen malé náhledy – v souladu s „Rozhodnuto“ k 1.3.
- **`PLAN.md`, Rozhodnuto nedělat:** „bez připojení se fotky nenačtou“ po 1.3 neplatí pro náhledy – text upravit
  (dělá vlastník): „bez připojení se nenačtou velké fotky; náhledy z mezipaměti ano“.
- **Index na `drive_file_id`** by byl změnou schématu → ne v 1.4; nanejvýš v 1.5 (úprava č. 12).
- **Nová závislost** `golang.org/x/oauth2` – v souladu s údržbou (knihovna od týmu Go), ale je to vědomé rozhodnutí.

## Rozhodnutí pro uživatele

1. Přesun záložní adresy z 1.2 do 1.3.2 a místo ní „Vyměnit soubor“ v 1.2.2 – **doporučeno**.
2. Server náhledů pro všechny velikosti (velké jen propustí) – **doporučeno**, nebo jen malé velikosti.
3. Výchozí limit náhledů: 1 GB (ROADMAP) / **2 GB** – při ~400 modelkách s desítkami fotek a růstu sbírky
   po letech se 1 GB naplní dřív, než bude sbírka v 90. letech.
4. Nová verze A „Rychlé přidávání“ hned za 1.4 – **doporučeno** (největší úspora času při denním plnění).
5. `golang.org/x/oauth2` / vlastní kód – **knihovna**.

---

## Text k vložení do ROADMAP.md

Nahradí oddíly `### 1.1` až `### 1.4`:

```markdown
### 1.1 – Google Disk I: přihlášení a výběr do alba

**Cíl:** fotky do alba přidávat výběrem z Disku přímo v programu místo kopírování odkazů (výběr na dalších
místech a nasdílení přijdou v 1.2). Prohlížení sbírky se nemění: fotky se dál zobrazují přes sdílené odkazy bez
přihlášení, takže odhlášení nebo vypršené přihlášení nikdy nezablokuje prohlížení. **Bez změny schématu
i exportu** – do databáze se dál ukládá jen ID souboru. Přihlašovací token se ukládá mimo databázi do
`~/.config/playboy-app/google.json` (práva jen pro uživatele), takže se nedostane do záloh, exportu ani
při přenosu složky dat na jiný počítač (tam se přihlásí znovu). Kroky podrobně: [PLAN-1X-DISK.md](docs/PLAN-1X-DISK.md).

**Rozhodnutí před začátkem:** rozsah `drive.file`, výběr Google (Picker) v systémovém prohlížeči, vlastní projekt
uživatele v Google Cloud (viz Rozhodnuto); potvrdí je prototyp.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 0 | Ověřovací prototyp (nevydává se) | Picker z `http://127.0.0.1:<pevný port>`, OAuth s PKCE, `setAppId` s číslem projektu, výběr 50+ souborů, výběr složky (dá `drive.file` přístup k souborům v ní?), `permissions.create`, produkční režim bez ověření a token po 7 dnech; výsledky do `PLAN.md` | M |
| 1 | Nastavení projektu a přihlášení (1.1.0) | `google.go`: OAuth pro desktop s PKCE a dočasným serverem na `127.0.0.1`, obnovovací token v `google.json` (0600), odhlášení zruší token i u Googlu; okno ⋯ → Google Disk… (ID klienta, klíč API, číslo projektu, stav); README „Google Disk v programu“ krok za krokem | M–L |
| 2 | Vybrat z Disku v okně alba (1.1.1) | Tlačítko u pole odkazů otevře Picker v prohlížeči, program počká (Zrušit); vybrané obrázky se vrátí do pole jako odkazy seřazené přirozeně podle názvu souboru, ukládání beze změny | M |
| 3 | Celá složka a velké výběry (1.1.2) | Podle prototypu výběr složky nebo Ctrl+A v Pickeru; vložený odkaz na složku nabídne „Vybrat tuto složku z Disku…“; nad 300 souborů potvrzení; `AddBulkPhotos` v jedné transakci a s kontrolou duplicit jedním dotazem | S–M |

**Rizika:** Google může změnit pravidla pro Picker nebo rozsahy (prototyp to ověří dřív, než se cokoli napojí);
`drive.file` nevidí soubory přidané dřív odkazem (pro ně zůstává dnešní kontrola bez přihlášení); únik tokenu =
přístup jen k vybraným souborům, odhlášení token zneplatní.

**Hotovo, když:** na čistém účtu jde podle README založit projekt a přihlásit se; album z 50 fotek ze složky
jde přidat jedním výběrem ve správném pořadí; odhlášený program dál normálně zobrazuje celou sbírku; token
není v databázi, zálohách ani exportu.

### 1.2 – Google Disk II: výběr všude, nasdílení, oprava odkazů

**Cíl:** výběr z Disku na všech místech, kde se přidávají fotky, a konec „nenačtených“ fotek kvůli sdílení
nebo smazání. Záložní adresa obrázků se přesunula do 1.3 (server náhledů ji použije sám).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Napojení na další místa (1.2.0) | „Z Disku…“ u titulní fotky, coveru, skenů článku a v nabídce alba „Přidat fotky z Disku…“; vkládání odkazů zůstává jako druhá cesta (funguje bez přihlášení) | S–M |
| 2 | Nasdílení (1.2.1) | Po výběru kontrola, které soubory nejsou sdílené „kdokoli s odkazem“; zaškrtávací volba „Nasdílet N souborů“ (nikdy potichu), `permissions.create` (čtenář, kdokoli), 4 souběžně, pauza při 429 | S |
| 3 | Kontrola s přihlášením a Vyměnit soubor (1.2.2) | U souborů z výběru „Zkontrolovat soubory“ rozliší v koši / smazaný / nenasdílený a nabídne nasdílení; „Vyměnit soubor z Disku…“ u nenačtené fotky a v Údržbě přepíše jen ID souboru, hodnocení, pořadí a otočení zůstanou, jde vrátit | M |

**Hotovo, když:** cover, titulní fotka i skeny jdou vybrat z Disku; nenasdílené fotky se po zaškrtnutí
nasdílí a zobrazí; smazaný a nenasdílený soubor se v kontrole rozliší; nefunkční fotka jde vyměnit bez ztráty
hodnocení.

### 1.3 – Náhledy na disku

**Cíl:** karty a dlaždice se zobrazí okamžitě i bez internetu. Jen malé náhledy (`w400`, `w600`); velké fotky
se dál stahují z Disku. Bez změny schématu i exportu.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Server náhledů (1.3.0) | `nahledy.go` jako `Handler` serveru aplikace: šablona obrázků `/nahled/{id}/{velikost}`, malé velikosti stáhne jednou do `~/.cache/playboy-app/nahledy/` (zápis přes dočasný soubor), velké propustí bez uložení; 8 souběžně, stejný požadavek = jedno stažení, zrušený požadavek zruší stažení; kontrola souborů dál jde přímo na Disk | M |
| 2 | Limit a správa (1.3.1) | Velikost spočítaná na pozadí, nad limitem se mažou nejdéle nepoužité (čas použití v `mtime`), úklid náhledů smazaných fotek po startu; okno ⋯ → Náhledy… s velikostí, limitem (500 MB–5 GB, `nastaveni`), odhadem celé sbírky, Vymazat náhledy a mezipaměť prohlížeče | S–M |
| 3 | Záložní adresa a bez připojení (1.3.2) | Při chybě `lh3` server zkusí `drive.google.com/thumbnail?id={id}&sz={velikost}`; předvolba v ⋯ → Adresa obrázků; bez připojení chybějící náhled hned 503 (rozhraní ho načte po návratu připojení); CSP `img-src` (ověřit na Fedoře) | S |
| 4 | Náhledy předem a měření (1.3.3) | „Stáhnout chybějící náhledy“ na pozadí (titulní fotky, plakáty, ohodnocené fotky, ostatní), 4 souběžně, pauza při výpadku a 429, pokračuje po restartu, zastaví se u limitu; zátěžová zkouška 2 000 modelek / 64 000 fotek: pohled pod 0,5 s, rolování bez prázdných karet, start pomalejší nejvýš o 50 ms | M |

**Hotovo, když:** po stažení náhledů se karty a dlaždice celé sbírky zobrazí okamžitě i bez internetu;
mezipaměť nepřekročí limit; „Vymazat náhledy“ ukáže a uvolní místo; přepnutí na záložní adresu zobrazí
sbírku stejně.

### 1.4 – Rychlé drobnosti

**Cíl:** čtyři malé věci, které zrychlí běžnou práci; každá vyjde jako samostatná verze (1.4.0–1.4.3).

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Upozornění na duplicitu (1.4.0) | Při ukládání okna alba program podle ID souboru najde fotky, které už ve sbírce jsou (u jiné modelky, v jiném albu, jako titulní fotka), a ukáže je v okně s volbou „Vynechat je / Přidat i tak“; jeden dotaz `IN (…)` bez nového indexu (index případně v 1.5) | S |
| 2 | Náhled vložených fotek (1.4.1) | Pod polem odkazů pás malých náhledů se stavem každé fotky (v pořádku, už ve sbírce, nenačte se) a ✕ pro odebrání odkazu; obnoví se po vložení | S–M |
| 3 | Automatické zamčení (1.4.2) | Při nastaveném heslu volba v okně hesla: zamknout po 5 / 15 / 30 minutách nečinnosti nebo nikdy (výchozí nikdy); nečinnost = žádná klávesa, klik ani rolování; zamčení překryvem bez přenačtení okna, takže rozepsaný formulář zůstane | S |
| 4 | Listování ročníky a čísly (1.4.3) | Na stránce ročníku šipky na předchozí a další rok téže edice, na stránce čísla na předchozí a další číslo (přeskočí čísla, která nevyšla); klávesy `[` a `]` | S |

**Hotovo, když:** vložení odkazu na fotku, která už ve sbírce je, vždy upozorní; vložené odkazy jsou před
uložením vidět jako náhledy; okno se samo zamkne po nastavené době a rozepsaný text nezmizí; ročníky i čísla
jdou listovat šipkami i klávesami.
```

Řádek do tabulky verzí (za 1.4, zatím s návrhovým číslem; po potvrzení se 1.5–1.11 posunou nebo verze dostane
další volné číslo):

```markdown
| 1.12+ (návrh) | Rychlé přidávání – klávesy v okně alba, další číslo, schránka a přetažení (zařadit hned za 1.4) | – (Alt+D až s 1.1) | – |
```

Oddíl verze (za `### 1.4`):

```markdown
### 1.12+ (návrh) – Rychlé přidávání

**Cíl:** desítky alb denně chronologicky po číslech bez myši a bez opakovaného vyplňování. Bez změny schématu
i exportu. Zařadit hned za 1.4.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Klávesy v okně alba | Ctrl+Enter = Uložit, Ctrl+Shift+Enter = Uložit a přidat další, Alt+D = Vybrat z Disku, Alt+F = fotograf; po vložení odkazů fokus na Uložit; v přehledu zkratek | S |
| 2 | Další číslo | „Uložit a přidat další“ u centerfoldu posune vydání na další číslo edice (přeskočí čísla, která nevyšla) a vyprázdní modelku; ve formuláři nové modelky „Uložit a přidat centerfold“ s prvním chybějícím číslem po posledním centerfoldu ve sbírce | S–M |
| 3 | Schránka a přetažení | Při otevření okna alba nabídka „Vložit N odkazů ze schránky“ (jen odkazy na Disk, které ve sbírce nejsou; nikdy samo); odkazy přetažené z prohlížeče na profil otevřou okno alba, na otevřené okno se přidají | S |

**Hotovo, když:** centerfoldy dvanácti čísel jednoho roku jdou přidat bez myši (kromě výběru fotek);
přetažený odkaz z prohlížeče skončí v poli odkazů; obsah schránky se nevloží bez kliknutí.
```

Do oddílu Rozhodnuto (po potvrzení):

```markdown
- Google Disk (1.1–1.3): záložní adresa obrázků v serveru náhledů (1.3), ne jako ruční přepínač v 1.2; oprava
  nefunkčního odkazu = výměna ID souboru se zachováním hodnocení, pořadí a otočení (1.2); limit náhledů
  v nastavení (výchozí podle rozhodnutí: 1 nebo 2 GB), náhledy předem jen na kliknutí.
```
