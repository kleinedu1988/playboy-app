# Revize: databáze učení a přepracovaná Údržba

Nezávislá revize sloučení `git diff 17faeea..d5c73c6` („Sloučení: vlastní databáze učení a přepracovaná Údržba“):
uceni.go, uceni_modely.go, navrhy.go, kontrola.go, kontrola_uceni.go, nastaveni.go (GetPrehled), app.go,
frontend/src/lib/udrzba.js, app/udrzba.js, app/uceni.js, app/navrhy.js, app/prehled.js, app/ulozeni.js.
Zaměřeno na skutečné chyby: souběh, životní cyklus databáze učení, zneplatnění mezipaměti, kalibrace (NaN/Inf),
odmítnutí jednotlivých hodnot, klávesnice, ztracené kliky ve WebKitGTK, XSS a zpětná vazba učení.

Čísla řádků jsou podle stavu po opravě. Závažnost: **vysoká** = ztráta nebo poškození dat, pád; **střední** =
špatné chování, které uživatel uvidí, nebo učení ze špatných dat; **nízká** = okrajový případ, výkon, odolnost.

## Opraveno

### 1. Obnovení ze zálohy se zapsalo jako „opravené nálezy“ – střední
- **Kde:** uceni.go:921 `nalezyKontroly`, app.go:524 `ObnovitZalohu`
- **Scénář:** modelka má nález (výška 250 cm), uživatel obnoví starší zálohu, kde je výška 170. Nález zmizí,
  otisk modelky se změnil, a tak se do deníku zapíše `nalez-opraveny` – jako by uživatel překlep opravil. Stejně
  tak každý jiný nález, který starší záloha nemá. Z toho se počítá přesnost pravidel a prahy kontroly.
- **Oprava:** `ObnovitZalohu` po výměně souboru zavolá `uc.poObnoveniSbirky()`; příští kontrola se s předchozími
  nálezy (ani s uloženými v souboru) neporovná a začne od nového stavu.
- **Test:** `TestObnoveniZalohyNeniOpravaNalezu` (bez opravy padá: „obnovení ze zálohy se zapsalo jako oprava“).

### 2. Nekonečná jistota z rozhraní rozbila GetStavUceni (Inf v JSON) – střední
- **Kde:** uceni.go:338 `zaznamenatNavrh`, uceni.go:362 `omezitJistotu`
- **Scénář:** návrh, který backend v posledním výpočtu nemá (odmítnutí z oznámení po novém načtení, starší
  seznam), se zapíše s jistotou, kterou poslalo rozhraní. Nesmyslná hodnota (∞, > 1) projde přes vážený součet
  do kalibrace zdroje: `presnost` vyjde ∞ a `json.Marshal(StavUceni)` selže („unsupported value: +Inf“). Wails
  pak Přehledu nevrátí stav učení vůbec a ∞ by se dostalo i do kalibrované jistoty návrhů.
- **Oprava:** jistota z rozhraní se do deníku zapíše jen v mezích 0–1 (NaN → 0).
- **Test:** `TestJistotaZRozhraniVMezich` (bez opravy padá na převodu na JSON).

### 3. Souběžná volání Přehledu počítala návrhy a kontrolu několikrát – nízká (výkon), u kontroly i dvojí zápis
- **Kde:** uceni.go:877 `navrhySbirky`, uceni.go:921 `nalezyKontroly`, prehled.js:57
- **Scénář:** `nacistPrehled` volá najednou `GetPrehled`, `GetNavrhyDoplneni` a `GetStavUceni`; všechna tři po
  změně dat nenajdou mezipaměť a počítají návrhy každé zvlášť (zámek se při výpočtu pouští), tedy 3× totéž
  (u 3000 modelek stovky ms CPU navíc) a 3 zápisy mezipaměti na pozadí. Dvě souběžná `GetPrehled` (Přehled se
  načítá i po akci a po uložení formuláře) navíc porovnají nálezy se stejným předchozím stavem a opravu nálezu
  zapíšou dvakrát.
- **Oprava:** výpočet návrhů a výpočet nálezů běží každý jen jednou najednou (`vypocetNavrhu`, `vypocetNalezu`,
  pořadí zámků vždy před `mu`); další volání počká a vezme výsledek z mezipaměti. Kontrola a návrhy se dál
  počítají souběžně navzájem.
- **Test:** `TestSoubeznePrehledAUceni` (souběžné GetPrehled/GetNavrhyDoplneni/GetStavUceni, odmítání, opravy
  a zapomínání pod `-race`; oprava nálezu právě jednou).

### 4. Prahy kontroly a otisk z různých okamžiků – nízká
- **Kde:** uceni.go:686 `prahyAGenerace`
- **Scénář:** `nalezyKontroly` četla prahy a generaci deníku každé pod jiným zámkem; událost zapsaná mezi tím
  (souběžné „V pořádku“) dala výsledek se staršími prahy pod otiskem novější generace a mezipaměť by ho vracela,
  dokud se sbírka nezmění.
- **Oprava:** prahy i generace se čtou pod jedním zámkem.

### 5. Oprava nálezu se poznávala i ze srdíček a titulní fotky – nízká
- **Kde:** uceni.go:767 `otiskUdajuKontroly`
- **Scénář:** nález zmizí z jiného důvodu (přidané modelky posunou naučený rozsah, jiná modelka se přejmenuje)
  a u modelky se mezitím změnila jen srdíčka (hodnotí se klávesami 1–5 přímo na kartě), titulní fotka, tagy nebo
  poznámka. Otisk celé modelky se změnil, a tak se zapsal `nalez-opraveny`, i když uživatel údaj neopravil.
- **Oprava:** pro poznání opravy se otiskují jen údaje, se kterými kontrola pracuje; otisk má předponu verze
  („k2:“) a otisk z dřívější verze se za opravu nepočítá.
- **Test:** `TestOtiskUdajuKontroly`.

### 6. Zavření databáze učení při ukončení bez zámku – nízká
- **Kde:** app.go:1036 `shutdown`, uceni.go:851 `zavrit`
- **Scénář:** `shutdown` četl a zavíral `uc.db` bez zámku; volání z rozhraní, které ještě doběhne, mohlo
  databázi současně otevírat (závod na poli `db`) nebo po zavření zapisovat do zavřeného spojení.
- **Oprava:** `zavrit()` počká na zápisy na pozadí, zavře databázi se zámkem a označí ji za zavřenou; další
  volání už nic neotevřou ani nezapíšou.

### 7. „V pořádku“ / „Netýká se“ hlásily úspěch, i když je backend neuložil – střední
- **Kde:** frontend/src/app/udrzba.js:545 `zapsatOdlozeni`
- **Scénář:** `SetNetykaSe`/`SetNetykaSeAlba` vrátí `false` (databáze jen pro čtení, zamčená); rozhraní výsledek
  nečetlo, položku odebralo z fronty, ukázalo „V pořádku: …“ s Vrátit a po novém načtení se položka vrátila.
- **Oprava:** místní data se mění jen podle toho, co se uložilo; při chybě zůstane položka ve frontě, oznámení
  řekne „… se nepodařilo uložit“ a fronta se znovu načte (u víc alb se mohla uložit jen část).
- **Ověřeno** v mock prohlížeči (`revize/klik.js`): před opravou 6 → 5 nálezů bez hlášky, po opravě 6 → 6
  a „V pořádku se nepodařilo uložit.“

### 8. Ztracený klik, když akce doběhne během stisknutého tlačítka – střední
- **Kde:** frontend/src/app/udrzba.js:424 `poZmene`, :450 `pustitMys`
- **Scénář:** „Přijmout“ u návrhu čeká na backend; uživatel mezitím stiskne „Odmítnout“ u dalšího. Když backend
  doběhne mezi stisknutím a puštěním, fronta se překreslí (vyřízená položka zmizí, řádky se posunou nebo vymění)
  a klik se ztratí – ve WebKitGTK vždy při výměně prvku, v Chromiu kvůli posunu řádků. Načtení po 1,5 s
  stisknutí hlídalo, překreslení po akci ne.
- **Oprava:** překreslení po akci se při stisknutém tlačítku odloží až za událost click (pointerup → setTimeout);
  stisknutí se ruší i při `pointercancel` a ztrátě fokusu okna (puštění mimo okno by jinak načítání
  i překreslení odkládalo donekonečna).
- **Ověřeno** v mock prohlížeči: před opravou se odmítnutí nezavolalo (0×), po opravě 1×.

### 9. Vymazané číselné pole se zapsalo jako oprava návrhu; jiný zápis téže hodnoty ne – střední
- **Kde:** frontend/src/app/uceni.js:100 `zaznamenat`, frontend/src/lib/udrzba.js:68 `opravaNavrhu`
- **Scénář:** „Upravit…“ u návrhu obvodu (90) a pole vymazat: formulář uloží 0, rozhraní poslalo
  `ZaznamenatOpravu(…, "90", "0")` a backend to počítal jako špatný návrh zdroje (komentář přitom říká, že
  prázdné pole oprava není). Naopak oprava jen tvaru („Ceska“ → „Česká“) se porovnávala bez diakritiky a velikosti
  písmen, takže se nezaznamenala vůbec – přitom právě z ní se backend učí, jak uživatel hodnotu píše (`zapisy`).
- **Oprava:** čistá funkce `opravaNavrhu`: prázdné pole i 0 nejsou oprava, porovnává se přesný text (kategorie
  dál „stačí obsažená“).
- **Test:** frontend/test/udrzba.test.js „oprava návrhu…“; v mock prohlížeči před opravou
  `[[2,"obvodHrudnikCm","90","0"]]`, po opravě nic.

### 10. Oprava návrhu alba se zaznamenala i po neúspěšném uložení – nízká
- **Kde:** frontend/src/app/ulozeni.js:264
- **Scénář:** `SetVydaniAlba`/`SetDatumAlba`/`SetPopisAlba` vrátí `false`, rozhraní přesto zavolalo
  `poUlozeniAlba` a učení dostalo hodnotu, která ve sbírce není.
- **Oprava:** `poUlozeniAlba` jen když se údaje alba opravdu uložily.

### 11. Přijatý návrh nechal ve frontě „chybí …“ až do nového načtení – nízká
- **Kde:** frontend/src/app/navrhy.js:83 `zapsatMistne`
- **Scénář:** po „Přijmout“ (národnost USA) zmizel návrh, ale skupina modelky dál ukazovala „chybí národnost“
  a pokrok se nezměnil, dokud se po 1,5 s Přehled nenačetl znovu (vrácení přijetí místní data naopak měnilo).
- **Oprava:** přijatá hodnota se zapíše i do místních modelek Přehledu (číslo jako číslo, kategorie připojená
  jako v backendu).

### 12. Datum „naposledy“ v panelu učení – nízká
- **Kde:** frontend/src/app/uceni.js:41
- **Scénář:** backend posílá „RRRR-MM-DD HH:MM:SS“; starší JavaScriptCore (WebKitGTK) tvar s mezerou nepřečte
  a „naposledy …“ se neukázalo.
- **Oprava:** mezera se před převodem nahradí „T“ (místní čas).

## Ponecháno

- **Souběh a závody (Go):** `go test -race ./... -count=1` nehlásí žádný DATA RACE ani před opravou, ani po ní
  (selhávají jen limity výkonových testů, které pod `-race` běží zhruba 5× pomaleji: `TestNavrhyRychlost`,
  `TestVykonUceni`, `TestVykonVelkeSbirky`, `TestReviseHledani`; bez `-race` projdou). Zápis mezipaměti na
  pozadí převádí na JSON data, která už nikdo nemění, a do databáze zapisuje pod zámkem; GetPrehled na
  souběžnou kontrolu vždy počká, takže žádná gorutina nepřežije volání ani výměnu `a.db` při obnovení.
- **Zneplatnění mezipaměti:** nenašel jsem úpravu, která by otisk nezměnila. Otisk obsahuje všechny údaje
  modelky, které návrhy a kontrola čtou (Odkazy a CoverURL žádné pravidlo nečte), alba s počtem fotek a součtem
  jejich ID (ID jsou AUTOINCREMENT, takže smazání a nová fotka součet vždy změní), dnešní datum, verzi výpočtu
  a generaci deníku (zapomenutí ji posune). Teoreticky by otisk nezměnila jen výměna fotek mezi dvěma alby téže
  modelky se stejným počtem i součtem ID – v programu na to akce není (přesun je vždy jedním směrem), proto
  ponecháno. `drive_file_id` mění jen `UpdateCover` a covery kontrola dvojic vynechává.
- **Odmítnutí a „nv-…“:** odmítnutí jedné hodnoty jde nejdřív do databáze učení a pak do sbírky; když zápis do
  sbírky selže, v učení zůstane odmítnutá hodnota, která se ale bez klíče `nv-…` neuplatní (klíč ve sbírce je
  rozhodující). Export a import nesou jen klíče `nv-…` → odmítnutí celého údaje, jak popisuje docs/UCENI.md.
  Ponecháno.
- **Přijetí přes „Upravit…“ beze změny se nezapíše jako přijetí:** rozhraní volá `ZaznamenatOpravu` jen při
  jiné hodnotě (backend by stejnou hodnotu uměl zapsat jako přijetí). Ponecháno podle zadání revize – kalibraci
  tím chybí část kladných rozhodnutí; zvážit volání i se stejnou hodnotou.
- **Vrácení přijatého návrhu (Vrátit v oznámení) se v deníku nezruší:** přijetí se dál počítá do kalibrace.
  Chybí na to backendové volání; ponecháno.
- **`ZaznamenatOpravu` u návrhů alba:** API nenese album, backend ho hledá v posledních návrzích podle modelky,
  údaje a hodnoty; při dvou albech téže modelky se stejnou navrženou hodnotou (fotograf) může zapsat kterékoli
  z nich (pořadí mapy). Na kalibraci zdroje to vliv nemá (zdroj i jistota jsou stejné). Ponecháno, změna API.
- **Panika v souběžné kontrole:** `GetPrehled` počítá nálezy v gorutině; případná panika v pravidle by shodila
  celý program místo jednoho volání. Žádnou cestu k panice jsem nenašel; ponecháno.
- **Kalibrace a matematika:** dělení nulou je ošetřené (`k.n <= 0`, `logit` omezuje na 0,001–0,999, Cholesky
  odmítne singulární matici, sousedé vyžadují σ > 0); s opravou č. 2 se NaN/Inf do JSON nedostane. Řazení
  i výběr jsou deterministické (stabilní řazení s úplným pořadím, mapy se před použitím řadí).
- **Klávesnice:** Ctrl+F v Údržbě nekoliduje s globálním hledáním (ulozeni.js ho v Přehledu přeskočí, pole
  hledání je tam vypnuté), klávesy fronty se zpracují na `#stats` dřív než globální a modální okna je blokují.
- **XSS:** všechny vkládané hodnoty z dat (jména, popisy, zdroje, hodnoty návrhů, hledání, soubor učení) jdou
  přes `esc()`; nevyescapované jsou jen konstanty a čísla.
- **Posluchače a vykreslení:** posluchači se registrují jednou (`pripravit`), pozorovatel konce fronty se před
  novým odpojí, části se přepisují přes `nastavitHtml` jen při změně a fronta po skupinách.
- **`content-visibility: auto` u skupin:** bez podpory se vlastnost ignoruje (jen pomalejší vykreslení);
  zvýraznění fokusu je `inset`, takže ho omezení vykreslení neořízne.

## Ověření

- `gofmt -l .` čisté, `go vet ./...` čisté, `go test ./... -count=1` prochází.
- `go test -race ./... -count=1`: žádný DATA RACE; selžou jen výkonové limity uvedené výše (stejně jako před
  revizí).
- Frontend: `npm run build`, `npm test` (36 testů), `npm run typy` bez chyb.
- Mock prohlížeč (Chromium, `run-ud.mjs` na vlastním portu nad dist z tohoto worktree): scénáře Údržby `po.js`
  a `po2.js` beze změny chování; nový scénář `revize/klik.js` (klik během dobíhající akce, selhání
  `SetNetykaSe`, vymazané číselné pole) proti dist před revizí ukazuje chyby 7–9, po revizi ne.
  Starý scénář `navrhy/po.js` cílí na zrušené řádky `.nv-radek` z doby před sloučením a na nové Údržbě
  neběží (není to regrese).
