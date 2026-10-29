# Návrh rozšíření: Tematické sezóny a Sezónní síň slávy

> **Stav dokumentu:** Návrh konceptu a architektury po verzi 1.0.  
> **Kontext:** Rozšíření stávající Síně slávy (`oblibenost_slava.go`), odznaků (`oblibenost_odznaky.go`) a hodnocení oblíbenosti o gamifikační a kurátorskou vrstvu tematických sezón inspirovanou mechanikami sezón v akčních RPG (např. Diablo IV).

---

## 1. Zhodnocení původního návrhu (Kalendářní klasika)

Původní kalendářní koncept („nejlepší za měsíc“) přináší čistou ergonomii a přirozenou orientaci v čase:

* **Pojmenování:**
  * Výraz **„Favoritka měsíce / sezóny“** je přesný, civilní a důstojný. Vyhýbá se bulvárnímu či seznamkovému vyznění slova *„Miláček“*, neplete se s oficiálními tituly časopisu (*Playmate měsíce / roku*) ani s odznakem *Královna* (který v síni slávy značí dny na 1. místě).
  * Jako alternativy s ještě prestižnějším tónem se nabízejí **„Ikona sezóny“** nebo **„Patronka sezóny“**, avšak *„Favoritka sezóny“* nejlépe vyjadřuje fakt, že jde o odraz preferencí a aktivity uživatele v daném období.
* **Štítek na kartě (`♛ 10/26` / `♛ Říjen 26`):**
  * Vynechání nadbytečných zkratek (žádné matoucí `PM`, `F` apod.) je optimální volba. Samotná miniaturní korunka se zkráceným datem je okamžitě vizuálně srozumitelná, elegantní a neubírá drahocenné místo v kompaktní mřížce karet.
* **Stupně odznaku (1×, 3×, 6×):**
  * Progrese odpovídá architektuře odznaků v aplikaci (bronz, stříbro, zlato, případně platina pro 6×).
  * Pokud modelka ovládne sezónu 6×, jde o naprostou dominanci v osobní síni slávy, která si zaslouží speciální vizuální akcent (např. platinový lem karty či zápis mezi legendy).

---

## 2. Koncept: Tematické sezóny ve stylu Diablo IV

Místo pouhého pasivního kalendářního součtu za uplynulý měsíc zavádí koncept **Tematické sezóny** aktivní událost. Cílem je motivovat uživatele k prozkoumávání starších ročníků, znovuobjevování zapomenutých pictorialů a hlubší práci s archivem.

### Převodní můstek mezi ARPG a Playboy Database

| Prvek z ARPG (Diablo IV) | Ekvivalent v Playboy Database | Implementace a fungování v praxi |
|---|---|---|
| **Název a téma sezóny** | **Téma (Afinita) sezóny** | Každá sezóna má specifický tematický filtr, éru či styl (např. *Zlatá devadesátá*, *Noir & Černobílá*, *Středoevropský půvab*, *Letní žár*, *Návrat do sedmdesátek*). |
| **Seasonal Blessing / Buff** | **Sezónní modifikátor skóre** | Pictorialy a modelky splňující afinitu sezóny (podle štítků, dekády/roku, kategorie, národnosti) získávají bonus (např. **+15 % až +25 %**) k sezónnímu bodovému zisku v duelech a hodnoceních. |
| **Season Journey (Kapitoly)** | **Sezónní výzvy (Milníky)** | Malý checklist 3 až 5 cílů na sezónu, které vedou uživatele archivem (např. *„Ohodnoť 10 pictorialů z let 1995–1999“*, *„Absolvuj 25 duelů v kategorii Muse“*, *„Najdi a ohodnoť dosud nehodnocenou modelku“*). |
| **Eternal vs. Seasonal Realm** | **Věčná Síň slávy vs. Živá sezóna** | Celková Síň slávy (historická Top 10, stálice, celkové Elo/body) běží nepřetržitě na pozadí jako „Eternal Realm“. Na kartě *Sezóna* se počítá čistě aktivita a výkony v probíhajícím časovém okně. |
| **Title / Cosmetic Reward** | **Unikátní zápis do Kroniky a profilu** | Vítězka nezíská jen suché datum, ale trvalý titul v kartě a kronice: např. *„Marta — Favoritka Sezóny černobílé múzy (Říjen 2026)“* s unikátní ikonou tématu. |

---

## 3. Vybalancování rolí: „Favoritka“ vs. „Miláček sezóny“

Oba pojmy nemusí kolidovat; naopak tvoří ideální dvojici reprezentující **objektivní herní statistiku** a **subjektivní osobní vkus**:

```
                              ┌─────────────────────────────────────────┐
                              │            SEZÓNA V ARCHIVU             │
                              │  (Aktivita, duely, hodnocení, buffy)   │
                              └────────────────────┬────────────────────┘
                                                   │
                         ┌─────────────────────────┴─────────────────────────┐
                         ▼                                                   ▼
       ┌───────────────────────────────────┐               ┌───────────────────────────────────┐
       │       FAVORITKA SEZÓNY (♛)        │               │       MILÁČEK SEZÓNY (♥)          │
       ├───────────────────────────────────┤               ├───────────────────────────────────┤
       │ • Matematická vítězka bodování    │               │ • Editor's Choice (volba srdcem)  │
       │ • Nejvyšší sezónní zisk z duelů   │               │ • Ruční udělení uživatelem        │
       │ • Ovlivněna tématem a buffem      │               │ • Pro modelku, která nejvíce      │
       │ • Plně automatické vyhodnocení    │               │   zaujala bez ohledu na tabulky   │
       └───────────────────────────────────┘               └───────────────────────────────────┘
```

1. **Favoritka sezóny (♛):**
   * **Mechanismus:** Matematický šampion. Modelka s nejvyšším bodovým ziskem v dané sezóně (vážené skóre z hodnocení pictorialů, výher ve vzájemných duelech a sezónního buffu).
   * **Význam:** Objektivní odraz toho, komu se v daném období dařilo nejvíce.
2. **Miláček sezóny (♥ / Wildcard / Volba editora):**
   * **Mechanismus:** Čistě uživatelská volba na konci sezóny. Při uzavírání sezóny nabídne aplikace uživateli dialog: *„Chceš udělit čestný titul Miláček sezóny některé z dalších favoritek?“*
   * **Význam:** Umožňuje ocenit skrytý klenot, nově objevenou tvář nebo pictorial, který sice tabulkově skončil čtvrtý, ale uživateli udělal největší radost.

---

## 4. Architektura UI a uživatelský zážitek

### 4.1. Průběžný stavový pás v záhlaví / v sekci „Hodnocení“

V kompaktní liště aplikace je neustále vidět puls aktuální události:

```
[ Sezóna 4: Zlatá devadesátá │ ♛ Vede: Marta (1 420 b.) │ ⏳ Zbývá 9 dní │ 🎯 Výzvy: 2/3 ]
```

* Kliknutím na lištu se otevře pohled sezóny.
* Pás neruší, ale jemně připomíná aktivní téma a stav výzev.

### 4.2. Samostatný pohled: Síň slávy → Sezóna

Rozhraní obsahuje tři hlavní komponenty:

#### A. Trůn aktuální sezóny (Živý žebříček Top 3)
* **1. místo (Vůdkyně sezóny):** Dominantní velká karta s náhledem pictorialu, aktuálním skóre a štítkem `♛ Průběžná favoritka`.
* **2. a 3. místo (Vyzyvatelky):** Karty s ukazatelem bodové ztráty (např. *„-45 b. na 1. místo“*) a přímým tlačítkem pro vyvolání duelu s vedoucí modelkou (*„Vyzvat na duel o trůn“*).

#### B. Pravidla, afinita a sezónní výzvy (Season Journey)
* **Karta tématu:** Popis afinity, např.:
  * *Téma:* Devadesátá léta (1990–1999) & Černobílá fotografie
  * *Aktivní požehnání:* +20 % k bodům z duelů a +1 bod k váze hodnocení pictorialu.
* **Sezónní výzvy (Milníky s ukazatelem průběhu):**
  * `[✓]` *Průzkumník archivu:* Ohodnoť 10 pictorialů z 90. let (10/10)
  * `[ ]` *Ostrý souboj:* Absolvuj 15 duelů s modely splňujícími téma (8/15)
  * `[ ]` *Korunní princ:* Uděl 5 hvězdiček dosud nehodnocené modelce (0/1)
* Splnění výzev může odemknout speciální odznak kroniky (např. *„Znalec zlaté éry“*).

#### C. Kronika sezón (Síň vítězek)
* Časová osa předchozích sezón.
* Každý záznam obsahuje:
  * Číslo a název sezóny (např. *Sezóna 3: Letní elegance*).
  * Období (např. *Září 2026*).
  * Vítěznou fotografii s korunkou a jménem Favoritky.
  * Udělený titul Miláčka sezóny (pokud byl zvolen).
  * Statistiky sezóny (kolik duelů proběhlo, kolik pictorialů bylo ohodnoceno).

---

## 5. Režim fungování: Kalendářní automatika vs. Ruční kampaň

Při návrhu životního cyklu sezóny vyvstává otázka, zda sezóny svázat striktně s kalendářním měsícem, nebo je pojmout jako ručně spouštěné kampaně.

### Porovnání variant

| Vlastnost | Varianta A: Striktně kalendářní měsíc | Varianta B: Ručně spouštěná kampaň | Varianta C: Kalendářní rytmus s ručním řízením (Doporučeno) |
|---|---|---|---|
| **Začátek a konec** | 1. den 00:00 až poslední den 23:59. | Uživatel klikne na „Zahájit sezónu“ a sám ji uzavře. | Výchozí měsíční cyklus, ale k uzavření a vyhlášení dojde až po potvrzení uživatelem. |
| **Výběr tématu** | Náhodný z předpřipraveného katalogu témat. | Uživatel si zvolí téma ze seznamu nebo zadá vlastní. | Aplikace navrhne téma na nový měsíc, uživatel ho může jedním klikem potvrdit nebo změnit. |
| **Riziko neaktivity** | Pokud uživatel týden neotevře aplikaci, sezóna „uteče“ bez obsahu. | Sezóna čeká, ale chybí vnější časový tlak a dynamika. | Žádné propadnutí: sezóna neexpiruje tiše v pozadí, finální vyhodnocení počká na návrat uživatele. |
| **Ergonomie** | Zcela bezúdržbové. | Vyžaduje administraci od uživatele. | Zlatá střední cesta – automatická nabídka, svoboda rozhodnutí. |

### Doporučené řešení: Hybridní model (Kampaň v kalendářním rytmu)

1. **Přirozený měsíční cyklus:**
   * Sezóny standardně korelují s měsíci (např. *Sezóna listopad 2026*), což zachovává přehlednou archivní strukturu (`♛ 11/26`).
2. **Žádné uzavírání „za zády“:**
   * Když skončí kalendářní měsíc, sezóna se nezamkne okamžitě sama. Při prvním dalším spuštění aplikace se zobrazí slavnostní rekapitulace:
     * *„Říjnová sezóna skončila! Zde jsou výsledky.“*
     * Možnost zvolit Miláčka sezóny (Editor's Choice).
     * Tlačítko: *„Uzavřít sezónu a zahájit novou: Listopad 2026 (Téma: ...)“*.
3. **Možnost pauzy:**
   * Pokud uživatel ví, že se aplikaci nebude věnovat, může sezónu pozastavit, aby nepřicházel o výzvy a zážitek z postupu.

---

## 6. Datový model a vazba na existující architekturu

Tento návrh je plně slučitelný s architekturou aplikace (nevyžaduje zásah do zmrazeného schématu databáze verze 12 před verzí 1.0; realizace je plánována do budoucích verzí):

1. **Ukládání stavu sezóny:**
   * Konfigurace aktivní a archivních sezón se ukládá do tabulky `nastaveni` (jako JSON struktura `sezona_aktivni` a `sezony_kronika`), případně do nového dedikovaného úložiště po 1.0.
2. **Bodování a výpočty:**
   * Počítá se za běhu z existujících tabulek `porovnani` (duele) a `hodnoceni` s časovým filtrem `od`–`do`.
   * Žádná duplicita databáze – vše je transparentně odvoditelné z historie akcí uživatele.
3. **Štítky na modelkách:**
   * Získané sezónní koruny se promítají do `OdznakModelky` jako specifický typ odznaku `sezona` s metadaty (ročník, měsíc, téma).
